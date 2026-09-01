import { describe, expect, it } from 'vitest';
import {
  type CollectDependencies,
  collect,
  collectPage,
} from '../../src/usecase/collect';

const page = (order: number) => ({
  url: `https://docs.test/${order}`,
  label: `Page ${order}`,
  order,
});

const response = (
  values: Partial<Tampermonkey.Response<undefined>> = {}
): Tampermonkey.Response<undefined> =>
  ({
    status: 200,
    responseHeaders: 'Content-Type: text/html',
    responseText: '<main><p>Body</p></main>',
    finalUrl: 'https://docs.test/final',
    ...values,
  }) as Tampermonkey.Response<undefined>;

const dependencies = (
  fetchResponse: Tampermonkey.Response<undefined> = response()
): CollectDependencies => ({
  fetcher: { fetch: async () => fetchResponse },
  extractor: {
    extract: () => ({
      title: 'Article',
      documentTitle: 'Document',
      contentHtml: '<p>Body</p>',
    }),
  },
  transformer: {
    transform: (html: string) => `<article>${html}</article>`,
  },
  sanitizer: { sanitize: (html: string) => html },
});

describe('collectPage', () => {
  it('fetches, extracts, transforms, and sanitizes one page in order', async () => {
    const calls: string[] = [];
    const result = await collectPage(page(0), {
      fetcher: {
        fetch: async (_url: string, timeout: number) => {
          calls.push(`fetch:${timeout}`);

          return response({
            responseHeaders: 'Content-Type: text/html; charset=utf-8',
            responseText: '<p>Raw</p>',
          });
        },
      },
      extractor: {
        extract: () => {
          calls.push('extract');

          return {
            title: 'Title',
            documentTitle: 'Document',
            contentHtml: '<p>Extracted</p>',
          };
        },
      },
      transformer: {
        transform: (html: string, sourceUrl: string, title: string) => {
          calls.push(`transform:${sourceUrl}:${title}`);

          return html;
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
      'fetch:20000',
      'extract',
      'transform:https://docs.test/final:Title',
      'sanitize',
    ]);
    expect(result).toMatchObject({
      type: 'success',
      article: { title: 'Title', contentHtml: '<p>Extracted</p>' },
    });
  });

  it.each([199, 300, 404, 500])('rejects HTTP status %s', async (status) => {
    const deps = dependencies(
      response({
        status,
        responseText: '<p>Error</p>',
        finalUrl: 'https://docs.test/error',
      })
    );

    await expect(collectPage(page(0), deps)).resolves.toMatchObject({
      type: 'failure',
      reason: `HTTP ${status}`,
    });
  });

  it.each(['text/html', 'application/xhtml+xml', null])(
    'accepts content type %s',
    async (contentType) => {
      const result = await collectPage(
        page(0),
        dependencies(
          response({
            responseHeaders: contentType ? `Content-Type: ${contentType}` : '',
            responseText: '<p>Body</p>',
            finalUrl: 'https://docs.test/page',
          })
        )
      );

      expect(result.type).toBe('success');
    }
  );

  it('rejects an explicit non-HTML content type before extraction', async () => {
    const result = await collectPage(
      page(0),
      dependencies(
        response({
          responseHeaders: 'Content-Type: application/pdf',
          responseText: '%PDF',
          finalUrl: 'https://docs.test/file.pdf',
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
    deps.extractor.extract = () => ({
      title: ' ',
      documentTitle: 'Document title',
      contentHtml: '<p>X</p>',
    });

    const labelled = await collectPage(page(0), deps);
    const documentTitle = await collectPage({ ...page(1), label: '' }, deps);
    deps.extractor.extract = () => ({
      title: null,
      documentTitle: ' ',
      contentHtml: '<p>X</p>',
    });
    const url = await collectPage({ ...page(2), label: '' }, deps);

    expect(labelled).toMatchObject({ article: { title: 'Page 0' } });
    expect(documentTitle).toMatchObject({
      article: { title: 'Document title' },
    });
    expect(url).toMatchObject({ article: { title: 'https://docs.test/2' } });
  });

  it('fails when Readability or sanitized content is empty', async () => {
    const noArticle = dependencies();
    noArticle.extractor.extract = () => null;
    const empty = dependencies();
    empty.sanitizer.sanitize = () => '   ';

    await expect(collectPage(page(0), noArticle)).resolves.toMatchObject({
      type: 'failure',
      reason: 'Readability returned no content',
    });
    await expect(collectPage(page(0), empty)).resolves.toMatchObject({
      type: 'failure',
      reason: 'Sanitized content is empty',
    });
  });
});

describe('collect', () => {
  it('limits concurrency to four and preserves input order', async () => {
    let active = 0;
    let maximum = 0;
    const deps = dependencies();
    deps.fetcher.fetch = async (url: string) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;

      return response({ finalUrl: url });
    };

    const result = await collect(
      Array.from({ length: 8 }, (_, i) => page(i)),
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
    deps.fetcher.fetch = async (url: string) => {
      if (url.endsWith('/1')) {
        throw new Error('offline');
      }

      return response({ finalUrl: url });
    };

    const result = await collect([page(0), page(1), page(2)], deps, {
      onProgress: (progress) => completed.push(progress.completed),
    });

    expect(result.map((item) => item.type)).toEqual([
      'success',
      'failure',
      'success',
    ]);
    expect(completed).toEqual([1, 2, 3]);
  });

  it('stops scheduling after cancellation and waits for active work', async () => {
    let cancelled = false;
    let started = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const deps = dependencies();
    deps.fetcher.fetch = async (url: string) => {
      started += 1;
      await gate;

      return response({ finalUrl: url });
    };

    const pending = collect(
      Array.from({ length: 6 }, (_, i) => page(i)),
      deps,
      {
        isCancelled: () => cancelled,
      }
    );
    await Promise.resolve();
    cancelled = true;
    release?.();
    const result = await pending;

    expect(started).toBe(4);
    expect(result.slice(0, 4).every((item) => item.type === 'success')).toBe(
      true
    );
    expect(result.slice(4).map((item) => item.type)).toEqual([
      'cancelled',
      'cancelled',
    ]);
  });
});
