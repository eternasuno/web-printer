import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { ArticleExtractorLive } from '../../src/adapter/readability';
import { ArticleExtractor } from '../../src/port';

const extractor = Effect.runSync(
  Effect.provide(ArticleExtractor, ArticleExtractorLive)
);

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
          <img src="image.png" alt="Example">
        </article>
      </main>
    </body>
  </html>
`;

describe('Readability adapter', () => {
  it('returns project-owned title and content HTML', () => {
    const result = extractor.extract(
      articleHtml,
      'https://docs.example.test/guide'
    );

    expect(result?.title).toBe('Fallback title');
    expect(result?.documentTitle).toBe('Fallback title');
    expect(result?.contentHtml).toContain('<code>');
    expect(result?.contentHtml).toContain('Cell');
    expect(result?.contentHtml).toContain('<img');
  });

  it('returns null when Readability finds no article', () => {
    const result = extractor.extract(
      '<html><body></body></html>',
      'https://docs.example.test/empty'
    );

    expect(result).toBeNull();
  });

  it('uses the source URL as the document parsing context', () => {
    const result = extractor.extract(
      articleHtml,
      'https://docs.example.test/guide/page'
    );

    expect(result).not.toBeNull();
  });
});
