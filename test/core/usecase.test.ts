import { describe, expect, it, vi } from 'vitest';
import type { ContentExtractorPort, DomPort, PageFetcherPort } from '../../src/core/port';
import { extractArticle, findLinks } from '../../src/core/usecase';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockDom = (overrides?: Partial<DomPort>): DomPort => ({
  findLinks: vi.fn<DomPort['findLinks']>().mockReturnValue([]),
  ...overrides,
});

const createMockFetcher = (overrides?: Partial<PageFetcherPort>): PageFetcherPort => ({
  fetchPage: vi.fn<PageFetcherPort['fetchPage']>().mockResolvedValue('<html></html>'),
  ...overrides,
});

const createMockExtractor = (overrides?: Partial<ContentExtractorPort>): ContentExtractorPort => ({
  extract: vi
    .fn<ContentExtractorPort['extract']>()
    .mockReturnValue({ title: 'Test', content: '<p>Test</p>' }),
  ...overrides,
});

// ---------------------------------------------------------------------------
// findLinks
// ---------------------------------------------------------------------------

describe('findLinks', () => {
  it('delegates to DomPort with the given selector', () => {
    const links = [{ text: 'Intro', url: '/docs/intro' }];
    const dom = createMockDom({ findLinks: vi.fn().mockReturnValue(links) });

    const result = findLinks(dom, 'nav a');

    expect(result).toEqual(links);
    expect(dom.findLinks).toHaveBeenCalledWith('nav a');
  });

  it('returns empty array when no links found', () => {
    const dom = createMockDom();
    expect(findLinks(dom, '.nonexistent')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractArticle
// ---------------------------------------------------------------------------

describe('extractArticle', () => {
  it('fetches and extracts a single article', async () => {
    const fetcher = createMockFetcher({
      fetchPage: vi.fn().mockResolvedValue('<html><body>Content</body></html>'),
    });
    const extractor = createMockExtractor({
      extract: vi.fn().mockReturnValue({ title: 'Test Page', content: '<p>Content</p>' }),
    });

    const article = await extractArticle(fetcher, extractor, 'https://example.com/page');

    expect(fetcher.fetchPage).toHaveBeenCalledWith('https://example.com/page');
    expect(extractor.extract).toHaveBeenCalledWith('<html><body>Content</body></html>');
    expect(article).toEqual({
      url: 'https://example.com/page',
      title: 'Test Page',
      content: '<p>Content</p>',
    });
  });

  it('propagates fetch error', async () => {
    const fetcher = createMockFetcher({
      fetchPage: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const extractor = createMockExtractor();

    await expect(extractArticle(fetcher, extractor, 'https://example.com/fail')).rejects.toThrow(
      'Network error',
    );
    expect(extractor.extract).not.toHaveBeenCalled();
  });

  it('propagates extraction error', async () => {
    const fetcher = createMockFetcher();
    const extractor = createMockExtractor({
      extract: vi.fn().mockImplementation(() => {
        throw new Error('No readable content');
      }),
    });

    await expect(extractArticle(fetcher, extractor, 'https://example.com/empty')).rejects.toThrow(
      'No readable content',
    );
  });
});