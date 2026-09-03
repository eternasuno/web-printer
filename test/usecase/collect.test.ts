import type { Readability } from '@mozilla/readability';
import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import type { CollectedPage, SelectedPage } from '../../src/entity';
import {
  ArticleExtractor,
  HtmlDocumentParser,
  HtmlSanitizer,
  type IArticleExtractor,
  type IHtmlDocumentParser,
  type IHtmlSanitizer,
  type IPageFetcher,
  PageFetcher,
} from '../../src/port';
import {
  type CollectServices,
  collect,
  collectPage,
} from '../../src/usecase/collect';

type FetchResponse = Tampermonkey.Response<undefined>;

type Stub = {
  fetcher: IPageFetcher;
  parser: IHtmlDocumentParser;
  extractor: IArticleExtractor;
  sanitizer: IHtmlSanitizer;
};

const page = (order: number) => ({
  url: `https://docs.test/${order}`,
  label: `Page ${order}`,
  order,
});

const response = (values: Partial<FetchResponse> = {}): FetchResponse =>
  ({
    status: 200,
    responseHeaders: 'Content-Type: text/html',
    responseText: '<main><p>Body</p></main>',
    finalUrl: 'https://docs.test/final',
    ...values,
  }) as FetchResponse;

const article = (
  title: string | null = 'Article',
  content = '<p>Body</p>'
): NonNullable<ReturnType<Readability['parse']>> =>
  ({ title, content }) as NonNullable<ReturnType<Readability['parse']>>;

const parseDocument = (html: string, url: string): Document => {
  const page = new DOMParser().parseFromString(html, 'text/html');
  Object.defineProperty(page, 'URL', { value: url });
  page.title = 'Document';

  return page;
};

const dependencies = (fetchResponse: FetchResponse = response()): Stub => ({
  fetcher: { fetch: () => Effect.succeed(fetchResponse) },
  parser: { parse: parseDocument },
  extractor: { extract: () => article() },
  sanitizer: { sanitize: (html: string) => html },
});

const layer = (ports: Stub): Layer.Layer<CollectServices> =>
  Layer.mergeAll(
    Layer.succeed(PageFetcher, ports.fetcher),
    Layer.succeed(HtmlDocumentParser, ports.parser),
    Layer.succeed(ArticleExtractor, ports.extractor),
    Layer.succeed(HtmlSanitizer, ports.sanitizer)
  );

const run = <A>(
  effect: Effect.Effect<A, never, CollectServices>,
  ports: Stub
): Promise<A> => Effect.runPromise(Effect.provide(effect, layer(ports)));

const collectedPage = (
  page: SelectedPage,
  stubs: Stub
): Promise<CollectedPage> => run(collectPage(page), stubs);

describe('collectPage', () => {
  it('fetches, parses, extracts, and sanitizes one page in order', async () => {
    const calls: string[] = [];
    const result = await collectedPage(page(0), {
      fetcher: {
        fetch: (_url: string, timeout: number) =>
          Effect.sync(() => {
            calls.push(`fetch:${timeout}`);

            return response({
              responseHeaders: 'Content-Type: text/html; charset=utf-8',
              responseText: '<p>Raw</p>',
            });
          }),
      },
      parser: {
        parse: (html: string, url: string) => {
          calls.push(`parse:${url}`);

          return parseDocument(html, url);
        },
      },
      extractor: {
        extract: (page: Document) => {
          calls.push(`extract:${page.URL}`);

          return article('Title', '<p>Extracted</p>');
        },
      },
      sanitizer: {
        sanitize: (html: string) => {
          calls.push('sanitize');

          return html;
        },
      },
    });

    expect(calls).toEqual([
      'fetch:10000',
      'parse:https://docs.test/final',
      'extract:https://docs.test/final',
      'sanitize',
    ]);
    expect(result).toMatchObject({
      type: 'success',
      article: { title: 'Title', contentHtml: '<p>Extracted</p>' },
    });
  });

  it.each([199, 300, 404, 500])('rejects HTTP status %s', async (status) => {
    const deps = dependencies(response({ status }));

    await expect(collectedPage(page(0), deps)).resolves.toMatchObject({
      type: 'failure',
      reason: `HTTP ${status}`,
    });
  });

  it.each(['text/html', 'application/xhtml+xml', null])(
    'accepts content type %s',
    async (contentType) => {
      const result = await collectedPage(
        page(0),
        dependencies(
          response({
            responseHeaders: contentType ? `Content-Type: ${contentType}` : '',
          })
        )
      );

      expect(result).toMatchObject({ type: 'success' });
    }
  );

  it('rejects an explicit non-HTML content type before extraction', async () => {
    const result = await collectedPage(
      page(0),
      dependencies(
        response({
          responseHeaders: 'Content-Type: application/pdf',
          responseText: '%PDF',
        })
      )
    );

    expect(result).toMatchObject({
      type: 'failure',
      reason: 'Unsupported content type: application/pdf',
    });
  });

  it('uses label, document title, and URL when extracted titles are missing', async () => {
    const deps = dependencies();
    const parse = (title: string) => {
      deps.parser.parse = (html: string, url: string) => {
        const result = parseDocument(html, url);
        result.title = title;

        return result;
      };
    };
    deps.extractor.extract = () => article(' ', '<p>X</p>');
    const labelled = await collectedPage(page(0), deps);
    parse('Document title');
    const documentTitle = await collectedPage({ ...page(1), label: '' }, deps);
    parse(' ');
    deps.extractor.extract = () => article(null, '<p>X</p>');
    const url = await collectedPage({ ...page(2), label: '' }, deps);

    expect(labelled).toMatchObject({ article: { title: 'Page 0' } });
    expect(documentTitle).toMatchObject({
      article: { title: 'Document title' },
    });
    expect(url).toMatchObject({ article: { title: 'https://docs.test/2' } });
  });

  it('fails when Readability or sanitized content is empty', async () => {
    const [noArticle, empty] = [dependencies(), dependencies()];
    noArticle.extractor.extract = () => null;
    empty.sanitizer.sanitize = () => '   ';

    await expect(collectedPage(page(0), noArticle)).resolves.toMatchObject({
      type: 'failure',
      reason: 'Readability returned no content',
    });
    await expect(collectedPage(page(0), empty)).resolves.toMatchObject({
      type: 'failure',
      reason: 'Sanitized content is empty',
    });
  });

  it.each([
    ['offline', new Error('offline')],
    ['Network error', { readyState: 0 }],
  ])('maps a fetch failure to %s', async (reason, error) => {
    const deps = dependencies();
    deps.fetcher.fetch = () => Effect.fail(error);

    await expect(collectedPage(page(0), deps)).resolves.toMatchObject({
      type: 'failure',
      reason,
    });
  });

  it('maps synchronous exceptions from the adapters to a page failure', async () => {
    const deps = dependencies();
    deps.fetcher.fetch = () => {
      throw new Error('fetch unavailable');
    };

    await expect(collectedPage(page(0), deps)).resolves.toMatchObject({
      type: 'failure',
      reason: 'fetch unavailable',
    });
    deps.fetcher.fetch = () => Effect.succeed(response());
    deps.parser.parse = () => {
      throw new SyntaxError('bad markup');
    };

    await expect(collectedPage(page(0), deps)).resolves.toMatchObject({
      type: 'failure',
      reason: 'bad markup',
    });
  });
});

describe('collect', () => {
  it('limits concurrency to four and preserves input order', async () => {
    let active = 0;
    let maximum = 0;
    const deps = dependencies();
    deps.fetcher.fetch = (url: string) =>
      Effect.promise(async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;

        return response({ finalUrl: url });
      });

    const result = await run(
      collect(Array.from({ length: 8 }, (_, i) => page(i))),
      deps
    );

    expect(maximum).toBe(4);
    expect(result.map((item) => item.page.order)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it('continues after a page failure and reports progress for each result', async () => {
    const completed: number[] = [];
    const deps = dependencies();
    deps.fetcher.fetch = (url: string) =>
      url.endsWith('/1')
        ? Effect.fail(new Error('offline'))
        : Effect.succeed(response({ finalUrl: url }));

    const result = await run(
      collect([page(0), page(1), page(2)], {
        onProgress: (progress) => completed.push(progress.completed),
      }),
      deps
    );

    expect(result.map((item) => item.type)).toEqual([
      'success',
      'failure',
      'success',
    ]);
    expect(completed).toEqual([1, 2, 3]);
  });

  it('stops scheduling and drops late results when interrupted', async () => {
    const controller = new AbortController();
    const completed: number[] = [];
    const aborted: string[] = [];
    let started = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const deps = dependencies();
    deps.fetcher.fetch = (url: string) =>
      Effect.callback<Tampermonkey.Response<undefined>, unknown>((resume) => {
        started += 1;
        void gate.then(() =>
          resume(Effect.succeed(response({ finalUrl: url })))
        );

        return Effect.sync(() => {
          aborted.push(url);
        });
      });
    const pending = Effect.runPromise(
      Effect.provide(
        collect(
          Array.from({ length: 6 }, (_, i) => page(i)),
          { onProgress: (progress) => completed.push(progress.completed) }
        ),
        layer(deps)
      ),
      { signal: controller.signal }
    );

    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toThrow(/interrupted/i);
    expect(started).toBe(4);
    expect(aborted.sort()).toEqual([0, 1, 2, 3].map((n) => page(n).url));

    release?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(completed).toEqual([]);
    expect(started).toBe(4);
  });
});
