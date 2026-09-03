import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { HtmlDocumentParserLive } from '../../src/adapter/html-document';
import { HtmlDocumentParser } from '../../src/port';

const parser = Effect.runSync(
  Effect.provide(HtmlDocumentParser, HtmlDocumentParserLive)
);

describe('HTML document adapter', () => {
  it('parses HTML with the source URL as its base URI', () => {
    const page = parser.parse(
      '<title>Guide</title><a href="../other">Other</a>',
      'https://docs.example.test/guide/page'
    );

    expect(page.title).toBe('Guide');
    expect(page.baseURI).toBe('https://docs.example.test/guide/page');
    expect(page.querySelector('a')?.href).toBe(
      'https://docs.example.test/other'
    );
  });

  it('overrides a document-provided base URL', () => {
    const page = parser.parse(
      '<base href="https://wrong.test/"><a href="page">Page</a>',
      'https://docs.example.test/guide/'
    );

    expect(page.querySelector('a')?.href).toBe(
      'https://docs.example.test/guide/page'
    );
  });
});
