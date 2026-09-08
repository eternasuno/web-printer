import { describe, expect, it } from '@effect/vitest';
import type { Readability } from '@mozilla/readability';
import { Effect, Layer } from 'effect';
import type { IHtmlDocumentParser } from '../../src/port';
import { collect, collectPage } from '../../src/usecase/collect';
import {
  ArticleExtractorLive,
  type FetchResponse,
  HtmlDocumentParserLive,
  HtmlSanitizerLive,
  link,
  PageFetcherLive,
  unreachable,
} from './mock';

const success = (values: Partial<FetchResponse> = {}): FetchResponse =>
  ({
    status: 200,
    responseHeaders: 'Content-Type: text/html',
    responseText: '<main><p>Body</p></main>',
    finalUrl: 'https://docs.test/final',
    ...values,
  }) as FetchResponse;

describe('collectPage', () => {
  it.effect(
    'should fetch, parse, extract, and sanitize one page in order',
    () =>
      Effect.gen(function* () {
        const calls: string[] = [];
        const fetched = success({ responseText: '<p>Raw</p>' });
        const result = yield* Effect.provide(
          collectPage(link(0)),
          Layer.mergeAll(
            PageFetcherLive(() =>
              Effect.sync(() => {
                calls.push('fetch');

                return fetched;
              })
            ),
            HtmlDocumentParserLive((html, url) =>
              Effect.sync(() => {
                calls.push(`parse:${url}:${html}`);
                const page = new DOMParser().parseFromString(html, 'text/html');
                Object.defineProperty(page, 'URL', { value: url });

                return page;
              })
            ),
            ArticleExtractorLive((page) =>
              Effect.sync(() => {
                calls.push(`extract:${page.URL}`);

                return {
                  title: 'Title',
                  content: '<p>Extracted</p>',
                } as NonNullable<ReturnType<Readability['parse']>>;
              })
            ),
            HtmlSanitizerLive((html) =>
              Effect.sync(() => {
                calls.push(`sanitize:${html}`);

                return html;
              })
            )
          )
        );

        expect(calls).toEqual([
          'fetch',
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
      })
  );

  it.effect('should use the link URL when the response has no final URL', () =>
    Effect.gen(function* () {
      const result = yield* Effect.provide(
        collectPage(link(1)),
        Layer.mergeAll(
          PageFetcherLive(() => Effect.succeed(success({ finalUrl: '' }))),
          HtmlDocumentParserLive(),
          ArticleExtractorLive(),
          HtmlSanitizerLive()
        )
      );

      expect(result).toMatchObject({ sourceUrl: 'https://docs.test/1' });
    })
  );

  it.effect.each([199, 300, 404, 500])(
    'should reject HTTP status %s',
    (status) =>
      Effect.gen(function* () {
        const result = yield* Effect.provide(
          collectPage(link(0)),
          Layer.mergeAll(
            PageFetcherLive(() => Effect.succeed(success({ status }))),
            HtmlDocumentParserLive(unreachable),
            ArticleExtractorLive(),
            HtmlSanitizerLive()
          )
        );

        expect(result).toMatchObject({
          type: 'failure',
          reason: `HTTP ${status}`,
        });
      })
  );

  it.effect.each([['text/html'], ['application/xhtml+xml'], [null]])(
    'should accept content type %s',
    ([contentType]) =>
      Effect.gen(function* () {
        const responseHeaders = contentType
          ? `Content-Type: ${contentType}`
          : '';
        const result = yield* Effect.provide(
          collectPage(link(0)),
          Layer.mergeAll(
            PageFetcherLive(() => Effect.succeed(success({ responseHeaders }))),
            HtmlDocumentParserLive(),
            ArticleExtractorLive(),
            HtmlSanitizerLive()
          )
        );

        expect(result).toMatchObject({ type: 'success' });
      })
  );

  it.effect('should reject non-HTML content before parsing', () =>
    Effect.gen(function* () {
      const result = yield* Effect.provide(
        collectPage(link(0)),
        Layer.mergeAll(
          PageFetcherLive(() =>
            Effect.succeed(
              success({ responseHeaders: 'Content-Type: application/pdf' })
            )
          ),
          HtmlDocumentParserLive(unreachable),
          ArticleExtractorLive(),
          HtmlSanitizerLive()
        )
      );

      expect(result).toMatchObject({
        type: 'failure',
        reason: 'Unsupported content type: application/pdf',
      });
    })
  );

  it.effect(
    'should use label, document title, and URL as title fallbacks',
    () =>
      Effect.gen(function* () {
        const parseWithTitle =
          (title: string): IHtmlDocumentParser['parse'] =>
          (html, url) =>
            Effect.sync(() => {
              const page = new DOMParser().parseFromString(html, 'text/html');
              Object.defineProperty(page, 'URL', { value: url });
              page.title = title;

              return page;
            });
        const blankTitle = {
          title: ' ',
          content: '<p>X</p>',
        } as NonNullable<ReturnType<Readability['parse']>>;
        const labelled = yield* Effect.provide(
          collectPage(link(0)),
          Layer.mergeAll(
            PageFetcherLive(),
            HtmlDocumentParserLive(),
            ArticleExtractorLive(() => Effect.succeed(blankTitle)),
            HtmlSanitizerLive()
          )
        );
        const documentTitle = yield* Effect.provide(
          collectPage({ ...link(1), label: '' }),
          Layer.mergeAll(
            PageFetcherLive(),
            HtmlDocumentParserLive(parseWithTitle('Document title')),
            ArticleExtractorLive(() => Effect.succeed(blankTitle)),
            HtmlSanitizerLive()
          )
        );
        const url = yield* Effect.provide(
          collectPage({ ...link(2), label: '' }),
          Layer.mergeAll(
            PageFetcherLive(),
            HtmlDocumentParserLive(parseWithTitle(' ')),
            ArticleExtractorLive(() =>
              Effect.succeed({
                title: null,
                content: '<p>X</p>',
              } as NonNullable<ReturnType<Readability['parse']>>)
            ),
            HtmlSanitizerLive()
          )
        );

        expect(labelled).toMatchObject({ title: 'Page 0' });
        expect(documentTitle).toMatchObject({ title: 'Document title' });
        expect(url).toMatchObject({ title: 'https://docs.test/2' });
      })
  );

  it.effect('should fail when extracted or sanitized content is empty', () =>
    Effect.gen(function* () {
      const noArticle = yield* Effect.provide(
        collectPage(link(0)),
        Layer.mergeAll(
          PageFetcherLive(),
          HtmlDocumentParserLive(),
          ArticleExtractorLive(() => Effect.succeed(null)),
          HtmlSanitizerLive(unreachable)
        )
      );
      const empty = yield* Effect.provide(
        collectPage(link(0)),
        Layer.mergeAll(
          PageFetcherLive(),
          HtmlDocumentParserLive(),
          ArticleExtractorLive(),
          HtmlSanitizerLive(() => Effect.succeed('   '))
        )
      );

      expect(noArticle).toMatchObject({
        type: 'failure',
        reason: 'Readability returned no content',
      });
      expect(empty).toMatchObject({
        type: 'failure',
        reason: 'Sanitized content is empty',
      });
    })
  );

  it.effect('should map fetch failures to page failures', () =>
    Effect.gen(function* () {
      const result = yield* Effect.provide(
        collectPage(link(0)),
        Layer.mergeAll(
          PageFetcherLive(() => Effect.fail(new Error('port failure'))),
          HtmlDocumentParserLive(),
          ArticleExtractorLive(),
          HtmlSanitizerLive()
        )
      );

      expect(result).toMatchObject({ type: 'failure', reason: 'port failure' });
    })
  );
});

describe('collect', () => {
  it.effect('should limit concurrency to four and preserve input order', () =>
    Effect.gen(function* () {
      let active = 0;
      let maximum = 0;
      const fetch = Effect.promise(async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;

        return success();
      });
      const result = yield* Effect.provide(
        collect(Array.from({ length: 8 }, (_, id) => link(id))),
        Layer.mergeAll(
          PageFetcherLive(() => fetch),
          HtmlDocumentParserLive(),
          ArticleExtractorLive(),
          HtmlSanitizerLive()
        )
      );

      expect(maximum).toBe(4);
      expect(result.map((post) => post.link.id)).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7,
      ]);
    })
  );

  it.effect('should continue after failures and report every result', () =>
    Effect.gen(function* () {
      const progress: number[] = [];
      const result = yield* Effect.provide(
        collect([link(0), link(1), link(2)], {
          onProgress: ({ completed }) => progress.push(completed),
        }),
        Layer.mergeAll(
          PageFetcherLive(() => Effect.fail(new Error('offline'))),
          HtmlDocumentParserLive(),
          ArticleExtractorLive(),
          HtmlSanitizerLive()
        )
      );

      expect(result.map((post) => post.type)).toEqual(
        Array.from({ length: 3 }, () => 'failure')
      );
      expect(progress).toEqual([1, 2, 3]);
    })
  );
});
