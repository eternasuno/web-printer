import { describe, expect, it } from 'vitest';
import { extractArticle } from '../../src/adapter/readability-extractor';

const base = 'https://docs.test/guide/page.html';

describe('Readability extractor', () => {
  it('extracts a real article fixture and falls back to document title', () => {
    const result = extractArticle(
      '<html><head><title>Fallback</title></head><body><article><h1>Article</h1><p>Readable fixture text with enough content to be selected.</p></article></body></html>',
      base
    );
    expect(result.content).toContain('Readable fixture text');
    expect(result.title).toBe('Fallback');
    const fallback = extractArticle(
      '<html><head><title>Document title</title></head><body><article><p>Enough readable fallback content here.</p></article></body></html>',
      base
    );
    expect(fallback.title).toBe('Document title');
    expect(
      extractArticle(
        '<html><body><article><p>Enough readable content for URL fallback.</p></article></body></html>',
        'https://docs.test/guide/url-fallback.html',
        7
      ).title
    ).toBe('url-fallback.html');
    expect(
      extractArticle(
        '<html><body><article><p>Enough readable content for page fallback.</p></article></body></html>',
        'https://docs.test/',
        7
      ).title
    ).toBe('Page 7');
  });
  it('absolutizes links and safe image sources, and normalizes srcset', () => {
    const result = extractArticle(
      '<html><body><article><p>Text</p><a href="../next" target="_blank">next</a><img src="/img.png" srcset="/small.png 1x, http://insecure.test/medium.png 2x, javascript:bad 3x, https://cdn.test/large.png 4x"></article></body></html>',
      base
    );
    expect(result.content).toContain('https://docs.test/img.png');
    expect(result.content).toContain('https://docs.test/next');
    expect(result.content).toContain('https://cdn.test/large.png 4x');
    expect(result.content).toContain('noopener noreferrer');
    expect(result.content).not.toContain('http://insecure.test/medium.png');
    expect(result.content).not.toContain('javascript:bad');
  });
  it('removes dangerous tags, attributes, protocols, and non-https images', () => {
    const result = extractArticle(
      '<html><body><article><p onclick="bad">Safe</p><script>alert(1)</script><style>x</style><iframe src="x"></iframe><svg><path/></svg><img src="javascript:bad" onerror="bad"><img src="http://insecure.test/x"></article></body></html>',
      base
    );
    expect(result.content).toContain('Safe');
    expect(result.content).not.toMatch(
      /script|style|iframe|svg|onclick|onerror|javascript:|http:\/\//i
    );
  });
  it('fails when readability or sanitization produces no content', () => {
    expect(() =>
      extractArticle(
        '<html><body><nav>Only navigation</nav></body></html>',
        base
      )
    ).not.toThrow();
    expect(() =>
      extractArticle(
        '<html><body><article><script>bad</script></article></body></html>',
        base
      )
    ).toThrow();
  });
});
