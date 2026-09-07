import { describe, expect, it } from '@effect/vitest';
import { Effect, Exit, Fiber } from 'effect';
import { collect } from '../../src/usecase/collect';
import {
  article,
  collectWith,
  dependencies,
  type FetchResponse,
  link,
  parseDocument,
  response,
  run,
  unreachable,
} from './collect-fixtures';

describe('collectPage', () => {
  it.effect('fetches, parses, extracts, and sanitizes one page in order', () =>
    Effect.gen(function* () {
      const calls: string[] = [];
      const track = <A>(label: string, value: A): Effect.Effect<A> => {
        calls.push(label);

        return Effect.succeed(value);
      };
      const fetched = response({
        responseHeaders: 'Content-Type: text/html; charset=utf-8',
        responseText: '<p>Raw</p>',
      });
      const result = yield* collectWith(link(0), {
        fetcher: {
          fetch: (_url, timeout) => track(`fetch:${timeout}`, fetched),
        },
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
    })
  );

  it.effect('uses the link URL when the response has no final URL', () =>
    Effect.gen(function* () {
      const deps = dependencies(response({ finalUrl: '' }));

      expect(yield* collectWith(link(1), deps)).toMatchObject({
        sourceUrl: 'https://docs.test/1',
      });
    })
  );

  it.effect.each([199, 300, 404, 500])('rejects HTTP status %s', (status) =>
    Effect.gen(function* () {
      const deps = dependencies(response({ status }));

      expect(yield* collectWith(link(0), deps)).toMatchObject({
        type: 'failure',
        reason: `HTTP ${status}`,
      });
    })
  );

  it.effect.each([['text/html'], ['application/xhtml+xml'], [null]])(
    'accepts content type %s',
    ([contentType]) =>
      Effect.gen(function* () {
        const headers = contentType ? `Content-Type: ${contentType}` : '';
        const result = yield* collectWith(
          link(0),
          dependencies(response({ responseHeaders: headers }))
        );

        expect(result).toMatchObject({ type: 'success' });
      })
  );

  it.effect('rejects an explicit non-HTML content type before extraction', () =>
    Effect.gen(function* () {
      const deps = dependencies(
        response({
          responseHeaders: 'Content-Type: application/pdf',
          responseText: '%PDF',
        })
      );
      deps.parser.parse = unreachable;

      expect(yield* collectWith(link(0), deps)).toMatchObject({
        type: 'failure',
        reason: 'Unsupported content type: application/pdf',
      });
    })
  );

  it.effect(
    'uses label, document title, and URL when extracted titles are missing',
    () =>
      Effect.gen(function* () {
        const deps = dependencies();
        const parse = (title: string) => {
          deps.parser.parse = (html, url) => {
            const result = parseDocument(html, url);
            result.title = title;

            return Effect.succeed(result);
          };
        };
        deps.extractor.extract = () => Effect.succeed(article(' ', '<p>X</p>'));
        const labelled = yield* collectWith(link(0), deps);
        parse('Document title');
        const documentTitle = yield* collectWith(
          { ...link(1), label: '' },
          deps
        );
        parse(' ');
        deps.extractor.extract = () =>
          Effect.succeed(article(null, '<p>X</p>'));
        const url = yield* collectWith({ ...link(2), label: '' }, deps);

        expect(labelled).toMatchObject({ title: 'Page 0' });
        expect(documentTitle).toMatchObject({ title: 'Document title' });
        expect(url).toMatchObject({ title: 'https://docs.test/2' });
      })
  );

  it.effect('fails when Readability or sanitized content is empty', () =>
    Effect.gen(function* () {
      const [noArticle, empty] = [dependencies(), dependencies()];
      noArticle.extractor.extract = () => Effect.succeed(null);
      noArticle.sanitizer.sanitize = unreachable;
      empty.sanitizer.sanitize = () => Effect.succeed('   ');

      expect(yield* collectWith(link(0), noArticle)).toMatchObject({
        type: 'failure',
        reason: 'Readability returned no content',
      });
      expect(yield* collectWith(link(0), empty)).toMatchObject({
        type: 'failure',
        reason: 'Sanitized content is empty',
      });
    })
  );

  it.effect.each<[string, Error]>([
    ['offline', new Error('offline')],
    ['Network error', new Error('Network error')],
  ])('maps a fetch failure to %s', ([reason, error]) =>
    Effect.gen(function* () {
      const deps = dependencies();
      deps.fetcher.fetch = () => Effect.fail(error);

      expect(yield* collectWith(link(0), deps)).toMatchObject({
        type: 'failure',
        reason,
      });
    })
  );

  it.effect(
    'maps parser, extractor, and sanitizer failures to page failures',
    () =>
      Effect.gen(function* () {
        const failing = () => Effect.fail(new Error('port failure'));
        const parse = dependencies();
        const extract = dependencies();
        const sanitize = dependencies();
        parse.parser.parse = failing;
        extract.extractor.extract = failing;
        sanitize.sanitizer.sanitize = failing;

        for (const deps of [parse, extract, sanitize]) {
          expect(yield* collectWith(link(0), deps)).toMatchObject({
            type: 'failure',
            reason: 'port failure',
          });
        }
      })
  );
});

describe('collect', () => {
  it.effect('limits concurrency to four and preserves input order', () =>
    Effect.gen(function* () {
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

      const result = yield* run(
        collect(Array.from({ length: 8 }, (_, i) => link(i))),
        deps
      );

      expect(maximum).toBe(4);
      const ids = result.map((item) => item.link.id);
      expect(ids).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    })
  );

  it.effect(
    'continues after a page failure and reports progress for each result',
    () =>
      Effect.gen(function* () {
        const progress: { completed: number; total: number }[] = [];
        const deps = dependencies();
        deps.fetcher.fetch = (url) =>
          url.endsWith('/1')
            ? Effect.fail(new Error('offline'))
            : Effect.succeed(response({ finalUrl: url }));

        const result = yield* run(
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
      })
  );

  it.effect('stops scheduling and drops late results when interrupted', () =>
    Effect.gen(function* () {
      const completed: number[] = [];
      const aborted: string[] = [];
      let started = 0;
      let release: (() => void) | undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let reportStarted: (() => void) | undefined;
      const fourStarted = new Promise<void>((resolve) => {
        reportStarted = resolve;
      });
      const deps = dependencies();
      deps.fetcher.fetch = (url) =>
        Effect.callback<FetchResponse, Error>((resume) => {
          started += 1;
          if (started === 4) {
            reportStarted?.();
          }
          void gate.then(() =>
            resume(Effect.succeed(response({ finalUrl: url })))
          );

          return Effect.sync(() => {
            aborted.push(url);
          });
        });
      const fiber = yield* Effect.forkChild(
        run(
          collect(
            Array.from({ length: 6 }, (_, i) => link(i)),
            {
              onProgress: (progress) => completed.push(progress.completed),
            }
          ),
          deps
        )
      );

      yield* Effect.promise(() => fourStarted);
      yield* Fiber.interrupt(fiber);
      const exit = yield* Effect.exit(Fiber.join(fiber));

      expect(Exit.hasInterrupts(exit)).toBe(true);
      expect(started).toBe(4);
      expect(aborted.sort()).toEqual([0, 1, 2, 3].map((n) => link(n).url));

      release?.();
      yield* Effect.promise(
        () => new Promise((resolve) => setTimeout(resolve, 0))
      );
      expect(completed).toEqual([]);
      expect(started).toBe(4);
    })
  );
});
