import type { Readability } from '@mozilla/readability';
import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import type { Link, Post } from '../../src/entity';
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

const link = (id: number): Link => ({
  id,
  url: `https://docs.test/${id}`,
  label: `Page ${id}`,
  path: `/${id}`,
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
  parser: {
    parse: (html, url) => Effect.succeed(parseDocument(html, url)),
  },
  extractor: { extract: () => Effect.succeed(article()) },
  sanitizer: { sanitize: (html) => Effect.succeed(html) },
});

// The collection ports are class-style service keys: the class instance type is
// what shows up in an effect's requirements channel.
const layer = (
  ports: Stub
): Layer.Layer<
  PageFetcher | HtmlDocumentParser | ArticleExtractor | HtmlSanitizer
> =>
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

const collectWith = (page: Link, stubs: Stub): Promise<Post> =>
  run(collectPage(page), stubs);

const unreachable = () => Effect.fail(new Error('stage reached'));

describe('collectPage', () => {
  it('fetches, parses, extracts, and sanitizes one page in order', async () => {
    const calls: string[] = [];
    const track = <A>(label: string, value: A): Effect.Effect<A> => {
      calls.push(label);

      return Effect.succeed(value);
    };
    const fetched = response({
      responseHeaders: 'Content-Type: text/html; charset=utf-8',
      responseText: '<p>Raw</p>',
    });
    const result = await collectWith(link(0), {
      fetcher: { fetch: (_url, timeout) => track(`fetch:${timeout}`, fetched) },
      parser: {
        parse: (html, url) =>
          track(`parse:${url}:${html}`, parseDocument(html, url)),
      },
      extractor: {
        extract: (page) =>
          track(`extract:${page.URL}`, article('Title', '<p>Extracted</p>')),
      },
      sanitizer: { sanitize: (html) => track(`sanitize:${html}`, html) },
    });

    expect(calls).toEqual([
      'fetch:10000',
      'parse:https://docs.test/final:<p>Raw</p>',
      'extract:https://docs.test/final',
      'sanitize:<p>Extracted</p>',
    ]);
    expect(result).toMatchObject({
      type: 'success',
      link: { id: 0, url: 'https://docs.test/0' },
      title: 'Title',
      contentHtml: '<p>Extracted</p>',
      sourceUrl: 'https://docs.test/final',
    });
  });

  it('uses the link URL when the response has no final URL', async () => {
    const deps = dependencies(response({ finalUrl: '' }));
    expect(await collectWith(link(1), deps)).toMatchObject({
      sourceUrl: 'https://docs.test/1',
    });
  });

  it.each([199, 300, 404, 500])('rejects HTTP status %s', async (status) => {
    const deps = dependencies(response({ status }));

    await expect(collectWith(link(0), deps)).resolves.toMatchObject({
      type: 'failure',
      reason: `HTTP ${status}`,
    });
  });

  it.each(['text/html', 'application/xhtml+xml', null])(
    'accepts content type %s',
    async (contentType) => {
      const headers = contentType ? `Content-Type: ${contentType}` : '';
      const result = await collectWith(
        link(0),
        dependencies(response({ responseHeaders: headers }))
      );
      expect(result).toMatchObject({ type: 'success' });
    }
  );

  it('rejects an explicit non-HTML content type before extraction', async () => {
    const deps = dependencies(
      response({
        responseHeaders: 'Content-Type: application/pdf',
        responseText: '%PDF',
      })
    );
    deps.parser.parse = unreachable;

    await expect(collectWith(link(0), deps)).resolves.toMatchObject({
      type: 'failure',
      reason: 'Unsupported content type: application/pdf',
    });
  });

  it('uses label, document title, and URL when extracted titles are missing', async () => {
    const deps = dependencies();
    const parse = (title: string) => {
      deps.parser.parse = (html, url) => {
        const result = parseDocument(html, url);
        result.title = title;

        return Effect.succeed(result);
      };
    };
    deps.extractor.extract = () => Effect.succeed(article(' ', '<p>X</p>'));
    const labelled = await collectWith(link(0), deps);
    parse('Document title');
    const documentTitle = await collectWith({ ...link(1), label: '' }, deps);
    parse(' ');
    deps.extractor.extract = () => Effect.succeed(article(null, '<p>X</p>'));
    const url = await collectWith({ ...link(2), label: '' }, deps);

    expect(labelled).toMatchObject({ title: 'Page 0' });
    expect(documentTitle).toMatchObject({ title: 'Document title' });
    expect(url).toMatchObject({ title: 'https://docs.test/2' });
  });

  it('fails when Readability or sanitized content is empty', async () => {
    const [noArticle, empty] = [dependencies(), dependencies()];
    noArticle.extractor.extract = () => Effect.succeed(null);
    noArticle.sanitizer.sanitize = unreachable;
    empty.sanitizer.sanitize = () => Effect.succeed('   ');

    await expect(collectWith(link(0), noArticle)).resolves.toMatchObject({
      type: 'failure',
      reason: 'Readability returned no content',
    });
    await expect(collectWith(link(0), empty)).resolves.toMatchObject({
      type: 'failure',
      reason: 'Sanitized content is empty',
    });
  });

  it.each([
    ['offline', new Error('offline')],
    ['Network error', new Error('Network error')],
  ])('maps a fetch failure to %s', async (reason, error) => {
    const deps = dependencies();
    deps.fetcher.fetch = () => Effect.fail(error);

    await expect(collectWith(link(0), deps)).resolves.toMatchObject({
      type: 'failure',
      reason,
    });
  });

  it('maps parser, extractor, and sanitizer failures to page failures', async () => {
    const failing = () => Effect.fail(new Error('port failure'));
    const parse = dependencies();
    const extract = dependencies();
    const sanitize = dependencies();
    parse.parser.parse = failing;
    extract.extractor.extract = failing;
    sanitize.sanitizer.sanitize = failing;

    for (const deps of [parse, extract, sanitize]) {
      await expect(collectWith(link(0), deps)).resolves.toMatchObject({
        type: 'failure',
        reason: 'port failure',
      });
    }
  });
});

describe('collect', () => {
  it('limits concurrency to four and preserves input order', async () => {
    let active = 0;
    let maximum = 0;
    const deps = dependencies();
    deps.fetcher.fetch = (url) =>
      Effect.promise(async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;

        return response({ finalUrl: url });
      });

    const result = await run(
      collect(Array.from({ length: 8 }, (_, i) => link(i))),
      deps
    );

    expect(maximum).toBe(4);
    const ids = result.map((item) => item.link.id);
    expect(ids).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('continues after a page failure and reports progress for each result', async () => {
    const progress: { completed: number; total: number }[] = [];
    const deps = dependencies();
    deps.fetcher.fetch = (url) =>
      url.endsWith('/1')
        ? Effect.fail(new Error('offline'))
        : Effect.succeed(response({ finalUrl: url }));

    const result = await run(
      collect([link(0), link(1), link(2)], {
        onProgress: (item) => progress.push(item),
      }),
      deps
    );

    const types = result.map((item) => item.type);
    expect(types).toEqual(['success', 'failure', 'success']);
    expect(progress).toEqual(
      [1, 2, 3].map((n) => ({ completed: n, total: 3 }))
    );
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
    deps.fetcher.fetch = (url) =>
      Effect.callback<Tampermonkey.Response<undefined>, Error>((resume) => {
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
          Array.from({ length: 6 }, (_, i) => link(i)),
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
    expect(aborted.sort()).toEqual([0, 1, 2, 3].map((n) => link(n).url));

    release?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(completed).toEqual([]);
    expect(started).toBe(4);
  });
});
