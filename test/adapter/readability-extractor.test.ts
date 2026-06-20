import { describe, expect, it, vi } from 'vitest';
import { createReadabilityExtractor } from '../../src/adapter/readability-extractor';

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
  return { Readability };
});

describe('extract', () => {
  it('extracts title and content from HTML', () => {
    const result = createReadabilityExtractor().extract(
      '<html><body><h1>Test</h1><p>Content</p></body></html>'
    );
    expect(result.title).toBe('Test Title');
    expect(result.content).toBe('<p>Test content</p>');
  });

  it('throws when no readable content found', () => {
    expect(() => createReadabilityExtractor().extract('<html><body></body></html>')).toThrow(
      'No readable content found'
    );
  });
});
