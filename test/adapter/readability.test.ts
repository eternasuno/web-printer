import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { HtmlDocumentParserLive } from '../../src/adapter/html-document';
import { ArticleExtractorLive } from '../../src/adapter/readability';
import { ArticleExtractor, HtmlDocumentParser } from '../../src/port';

const articleHtml = `
  <!doctype html>
  <html>
    <head><title>Fallback title</title></head>
    <body>
      <nav>Navigation</nav>
      <main>
        <article>
          <h1>Readable guide</h1>
          <p>This is the first substantial paragraph of the guide content.</p>
          <p>This is the second substantial paragraph with more useful text.</p>
          <pre><code>const value = 1;</code></pre>
          <table><tbody><tr><td>Cell</td></tr></tbody></table>
          <a href="../other">Other</a>
          <img src="standard.png" srcset="small.png 1x, /large.png 2x" alt="Standard">
          <picture><source srcset="wide.webp 800w"></picture>
          <img data-src="lazy.png" data-srcset="lazy-small.png 1x, lazy-large.png 2x" alt="Lazy">
        </article>
      </main>
    </body>
  </html>
`;

const parse = (html: string, url: string) => {
  const page = Effect.runSync(
    Effect.provide(HtmlDocumentParser, HtmlDocumentParserLive)
  ).parse(html, url);
  const extractor = Effect.runSync(
    Effect.provide(ArticleExtractor, ArticleExtractorLive)
  );

  return extractor.extract(page);
};

describe('Readability adapter', () => {
  it('returns the Readability result with resolved resources', () => {
    const result = parse(articleHtml, 'https://docs.example.test/guide/page');

    expect(result?.title).toBe('Fallback title');
    expect(result?.content).toContain('<code>');
    expect(result?.content).toContain('Cell');
    expect(result?.content).toContain('https://docs.example.test/other');
    expect(result?.content).toContain(
      'https://docs.example.test/guide/standard.png'
    );
    expect(result?.content).toContain(
      'https://docs.example.test/guide/small.png 1x'
    );
    expect(result?.content).toContain('https://docs.example.test/large.png 2x');
    expect(result?.content).toContain(
      'https://docs.example.test/guide/wide.webp 800w'
    );
    expect(result?.content).toContain(
      'https://docs.example.test/guide/lazy.png'
    );
    expect(result?.content).toContain(
      'https://docs.example.test/guide/lazy-small.png 1x'
    );
  });

  it('returns null when Readability finds no article', () => {
    const result = parse(
      '<html><body></body></html>',
      'https://docs.example.test/empty'
    );

    expect(result).toBeNull();
  });

  it('does not modify the supplied document', () => {
    const page = Effect.runSync(
      Effect.provide(HtmlDocumentParser, HtmlDocumentParserLive)
    ).parse(articleHtml, 'https://docs.example.test/guide/page');
    const before = page.documentElement.outerHTML;

    Effect.runSync(
      Effect.provide(ArticleExtractor, ArticleExtractorLive)
    ).extract(page);

    expect(page.documentElement.outerHTML).toBe(before);
  });
});
