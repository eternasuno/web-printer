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

const createMockExtractor = (
  overrides?: Partial<ContentExtractorPort>
): ContentExtractorPort => ({
  extract: vi
    .fn<ContentExtractorPort['extract']>()
    .mockReturnValue({ content: '<p>Test</p>', title: 'Test' }),
  ...overrides,
});

// ---------------------------------------------------------------------------
// findLinks
// ---------------------------------------------------------------------------

describe('findLinks', () => {
  it('delegates to DomPort with the given selector', () => {
    const links = [{ text: 'Intro', url: 'https://example.com/docs/intro' }];
    const dom = createMockDom({ findLinks: vi.fn().mockReturnValue(links) });

    const result = findLinks('nav a')(dom);

    expect(result).toEqual(links);
    expect(dom.findLinks).toHaveBeenCalledWith('nav a');
  });

  it('returns empty array when no links found', () => {
    const dom = createMockDom();
    expect(findLinks('.nonexistent')(dom)).toEqual([]);
  });

  it('filters out javascript: URLs', () => {
    const dom = createMockDom({
      findLinks: vi.fn().mockReturnValue([
        { text: 'Click', url: 'javascript:void(0)' },
        { text: 'Intro', url: 'https://example.com/intro' },
      ]),
    });
    const result = findLinks('a')(dom);
    expect(result).toEqual([{ text: 'Intro', url: 'https://example.com/intro' }]);
  });

  it('filters out mailto: URLs', () => {
    const dom = createMockDom({
      findLinks: vi.fn().mockReturnValue([
        { text: 'Email', url: 'mailto:test@example.com' },
        { text: 'Docs', url: 'https://example.com/docs' },
      ]),
    });
    const result = findLinks('a')(dom);
    expect(result).toEqual([{ text: 'Docs', url: 'https://example.com/docs' }]);
  });

  it('filters out empty fragment URLs', () => {
    const dom = createMockDom({
      findLinks: vi.fn().mockReturnValue([
        { text: 'Top', url: '#' },
        { text: 'Guide', url: 'https://example.com/guide' },
      ]),
    });
    const result = findLinks('a')(dom);
    expect(result).toEqual([{ text: 'Guide', url: 'https://example.com/guide' }]);
  });

  it('filters out non-HTTP URLs', () => {
    const dom = createMockDom({
      findLinks: vi.fn().mockReturnValue([
        { text: 'FTP', url: 'ftp://files.example.com' },
        { text: 'Page', url: 'https://example.com/page' },
      ]),
    });
    const result = findLinks('a')(dom);
    expect(result).toEqual([{ text: 'Page', url: 'https://example.com/page' }]);
  });

  it('deduplicates identical URLs keeping first occurrence', () => {
    const dom = createMockDom({
      findLinks: vi.fn().mockReturnValue([
        { text: 'Intro', url: 'https://example.com/docs/intro' },
        { text: 'Introduction', url: 'https://example.com/docs/intro' },
      ]),
    });
    const result = findLinks('a')(dom);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Intro');
  });

  it('filters out URLs starting with ://', () => {
    const dom = createMockDom({
      findLinks: vi.fn().mockReturnValue([
        { text: 'Broken', url: '://invalid' },
        { text: 'Valid', url: 'https://example.com/valid' },
      ]),
    });
    const result = findLinks('a')(dom);
    expect(result).toEqual([{ text: 'Valid', url: 'https://example.com/valid' }]);
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
      extract: vi.fn().mockReturnValue({ content: '<p>Content</p>', title: 'Test Page' }),
    });

    const article = await extractArticle('https://example.com/page')({ extractor, fetcher });

    expect(fetcher.fetchPage).toHaveBeenCalledWith('https://example.com/page');
    expect(extractor.extract).toHaveBeenCalledWith('<html><body>Content</body></html>');
    expect(article).toEqual({
      content: '<p>Content</p>',
      title: 'Test Page',
      url: 'https://example.com/page',
    });
  });

  it('propagates fetch error', async () => {
    const fetcher = createMockFetcher({
      fetchPage: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const extractor = createMockExtractor();

    await expect(
      extractArticle('https://example.com/fail')({ extractor, fetcher })
    ).rejects.toThrow('Network error');
    expect(extractor.extract).not.toHaveBeenCalled();
  });

  it('propagates extraction error', async () => {
    const fetcher = createMockFetcher();
    const extractor = createMockExtractor({
      extract: vi.fn().mockImplementation(() => {
        throw new Error('No readable content');
      }),
    });

    await expect(
      extractArticle('https://example.com/empty')({ extractor, fetcher })
    ).rejects.toThrow('No readable content');
  });
});
