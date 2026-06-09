import { describe, expect, it, vi } from 'vitest';
import { createReadabilityExtractor } from '../../src/adapter/readability-extractor';
import type { FetchResult } from '../../src/core/entity';

vi.mock('@mozilla/readability', () => {
  const Readability = class {
    private doc: Document;
    constructor(doc: Document) {
      this.doc = doc;
    }
    parse() {
      const body = this.doc.body?.textContent ?? '';
      if (!body.trim()) return null;
      return { content: '<p>Test content</p>', title: 'Test Title' };
    }
  };
  return { default: Readability, Readability };
});

describe('extractPages', () => {
  it('extracts content from fetch results', () => {
    const pages: FetchResult[] = [
      {
        html: '<html><body><h1>Test</h1><p>Content</p></body></html>',
        ok: true,
        url: 'https://example.com/page',
      },
    ];
    const result = createReadabilityExtractor().extractPages(pages);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test Title');
    expect(result[0].html).toBe('<p>Test content</p>');
    expect(result[0].url).toBe('https://example.com/page');
  });

  it('skips failed pages', () => {
    const pages: FetchResult[] = [
      { html: '<html><body>OK</body></html>', ok: true, url: 'https://example.com/ok' },
      { error: '404', html: '', ok: false, url: 'https://example.com/fail' },
    ];
    const result = createReadabilityExtractor().extractPages(pages);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/ok');
  });
});
