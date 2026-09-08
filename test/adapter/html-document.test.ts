import { expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import { HtmlDocumentParserLive } from '../../src/adapter/html-document';
import { HtmlDocumentParser } from '../../src/port';

const parse = (html: string, url: string) =>
  Effect.gen(function* () {
    const parser = yield* HtmlDocumentParser;

    return yield* parser.parse(html, url);
  });

it.layer(HtmlDocumentParserLive)('HTML document adapter', (it) => {
  it.effect('should parse HTML with the source URL as its base URI', () =>
    Effect.gen(function* () {
      const page = yield* parse(
        '<title>Guide</title><a href="../other">Other</a>',
        'https://docs.example.test/guide/page'
      );

      expect(page.title).toBe('Guide');
      expect(page.baseURI).toBe('https://docs.example.test/guide/page');
      expect(page.querySelector('a')?.href).toBe(
        'https://docs.example.test/other'
      );
    })
  );

  it.effect('should override a document-provided base URL', () =>
    Effect.gen(function* () {
      const page = yield* parse(
        '<base href="https://wrong.test/"><a href="page">Page</a>',
        'https://docs.example.test/guide/'
      );

      expect(page.querySelector('a')?.href).toBe(
        'https://docs.example.test/guide/page'
      );
    })
  );
});
