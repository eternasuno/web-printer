import { describe, expect, it, vi } from 'vitest';
import type { Article } from '../../src/core/entity';
import type { Dom, Extractor, Http } from '../../src/core/port';
import { extractArticle, extractArticlesStream, findLinks } from '../../src/core/usecase';

const collect = async (gen: AsyncGenerator<Article>): Promise<Article[]> => {
  const out: Article[] = [];
  for await (const article of gen) out.push(article);
  return out;
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockDom = (overrides?: Partial<Dom>): Dom => ({
  findLinks: vi.fn<Dom['findLinks']>().mockReturnValue([]),
  ...overrides,
});

const createMockFetcher = (overrides?: Partial<Http>): Http => ({
  fetchPage: vi.fn<Http['fetchPage']>().mockResolvedValue('<html></html>'),
  ...overrides,
});

const createMockExtractor = (overrides?: Partial<Extractor>): Extractor => ({
  extract: vi
    .fn<Extractor['extract']>()
    .mockReturnValue({ content: '<p>Test</p>', title: 'Test' }),
  ...overrides,
});

// ---------------------------------------------------------------------------
// findLinks
// ---------------------------------------------------------------------------

describe('findLinks', () => {
  it('delegates to Dom with the given selector', () => {
    const links = [{ text: 'Intro', url: 'https://example.com/docs/intro' }];
    const dom = createMockDom({ findLinks: vi.fn().mockReturnValue(links) });

    const result = findLinks('nav a')('example.com')(dom);

    expect(result).toEqual(links);
    expect(dom.findLinks).toHaveBeenCalledWith('nav a');
  });

  it('returns empty array when no links found', () => {
    const dom = createMockDom();
    expect(findLinks('.nonexistent')('example.com')(dom)).toEqual([]);
  });

  it('filters out javascript: URLs', () => {
    const dom = createMockDom({
      findLinks: vi.fn().mockReturnValue([
        { text: 'Click', url: 'javascript:void(0)' },
        { text: 'Intro', url: 'https://example.com/intro' },
      ]),
    });
    const result = findLinks('a')('example.com')(dom);
    expect(result).toEqual([{ text: 'Intro', url: 'https://example.com/intro' }]);
  });

  it('filters out mailto: URLs', () => {
    const dom = createMockDom({
      findLinks: vi.fn().mockReturnValue([
        { text: 'Email', url: 'mailto:test@example.com' },
        { text: 'Docs', url: 'https://example.com/docs' },
      ]),
    });
    const result = findLinks('a')('example.com')(dom);
    expect(result).toEqual([{ text: 'Docs', url: 'https://example.com/docs' }]);
  });

  it('filters out empty fragment URLs', () => {
    const dom = createMockDom({
      findLinks: vi.fn().mockReturnValue([
        { text: 'Top', url: '#' },
        { text: 'Guide', url: 'https://example.com/guide' },
      ]),
    });
    const result = findLinks('a')('example.com')(dom);
    expect(result).toEqual([{ text: 'Guide', url: 'https://example.com/guide' }]);
  });

  it('filters out non-HTTP URLs', () => {
    const dom = createMockDom({
      findLinks: vi.fn().mockReturnValue([
        { text: 'FTP', url: 'ftp://files.example.com' },
        { text: 'Page', url: 'https://example.com/page' },
      ]),
    });
    const result = findLinks('a')('example.com')(dom);
    expect(result).toEqual([{ text: 'Page', url: 'https://example.com/page' }]);
  });

  it('deduplicates identical URLs keeping first occurrence', () => {
    const dom = createMockDom({
      findLinks: vi.fn().mockReturnValue([
        { text: 'Intro', url: 'https://example.com/docs/intro' },
        { text: 'Introduction', url: 'https://example.com/docs/intro' },
      ]),
    });
    const result = findLinks('a')('example.com')(dom);
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
    const result = findLinks('a')('example.com')(dom);
    expect(result).toEqual([{ text: 'Valid', url: 'https://example.com/valid' }]);
  });

  it('filters out cross-domain URLs to prevent CORS issues', () => {
    const dom = createMockDom({
      findLinks: vi.fn().mockReturnValue([
        { text: 'Same Domain', url: 'https://example.com/page' },
        { text: 'Other Domain', url: 'https://other-site.com/page' },
        { text: 'Subdomain', url: 'https://docs.example.com/page' },
      ]),
    });
    const result = findLinks('a')('example.com')(dom);
    expect(result).toEqual([{ text: 'Same Domain', url: 'https://example.com/page' }]);
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

// ---------------------------------------------------------------------------
// extractArticlesStream
// ---------------------------------------------------------------------------

describe('extractArticlesStream', () => {
  it('yields all extracted articles in source order', async () => {
    const fetcher = createMockFetcher({
      fetchPage: vi
        .fn()
        .mockImplementation((url: string) => Promise.resolve(`<html><body>${url}</body></html>`)),
    });
    const extractor = createMockExtractor({
      extract: vi.fn().mockImplementation((html: string) => ({ content: html, title: html })),
    });
    const urls = ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'];

    const articles = await collect(
      extractArticlesStream(urls)({ concurrency: 2, interval: 0, timeout: 5000 })({
        extractor,
        fetcher,
      })
    );

    expect(articles.map((a) => a.url)).toEqual(urls);
  });

  it('preserves source order even when later urls finish first', async () => {
    const fetcher = createMockFetcher({
      fetchPage: vi.fn().mockImplementation(
        (url: string) =>
          new Promise<string>((resolve) => {
            const wait = url.endsWith('/a') ? 50 : 10;
            setTimeout(() => resolve(`<html><body>${url}</body></html>`), wait);
          })
      ),
    });
    const extractor = createMockExtractor({
      extract: vi.fn().mockImplementation((html: string) => ({ content: html, title: html })),
    });
    const urls = ['https://example.com/a', 'https://example.com/b'];

    const articles = await collect(
      extractArticlesStream(urls)({ concurrency: 2, interval: 0, timeout: 5000 })({
        extractor,
        fetcher,
      })
    );

    expect(articles.map((a) => a.url)).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
  });

  it('respects the concurrency limit', async () => {
    let inflight = 0;
    let maxInflight = 0;
    const fetcher = createMockFetcher({
      fetchPage: vi.fn().mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            inflight += 1;
            maxInflight = Math.max(maxInflight, inflight);
            setTimeout(() => {
              inflight -= 1;
              resolve('<html></html>');
            }, 10);
          })
      ),
    });
    const extractor = createMockExtractor();
    const urls = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`);

    await collect(
      extractArticlesStream(urls)({ concurrency: 2, interval: 0, timeout: 5000 })({
        extractor,
        fetcher,
      })
    );

    expect(maxInflight).toBeLessThanOrEqual(2);
  });

  it('skips failed urls and yields the rest', async () => {
    const fetcher = createMockFetcher({
      fetchPage: vi
        .fn()
        .mockImplementation((url: string) =>
          url.includes('fail')
            ? Promise.reject(new Error('Network error'))
            : Promise.resolve('<html></html>')
        ),
    });
    const extractor = createMockExtractor();
    const urls = ['https://example.com/a', 'https://example.com/fail', 'https://example.com/c'];

    const articles = await collect(
      extractArticlesStream(urls)({ concurrency: 1, interval: 0, timeout: 5000 })({
        extractor,
        fetcher,
      })
    );

    expect(articles.map((a) => a.url)).toEqual([
      'https://example.com/a',
      'https://example.com/c',
    ]);
  });

  it('times out slow fetches and skips them', async () => {
    const fetcher = createMockFetcher({
      fetchPage: vi
        .fn()
        .mockImplementation(
          () => new Promise<string>((resolve) => setTimeout(() => resolve('<html></html>'), 500))
        ),
    });
    const extractor = createMockExtractor();
    const urls = ['https://example.com/slow'];

    const articles = await collect(
      extractArticlesStream(urls)({ concurrency: 1, interval: 0, timeout: 30 })({
        extractor,
        fetcher,
      })
    );

    expect(articles).toEqual([]);
  });

  it('waits the interval between consecutive fetches', async () => {
    const timestamps: number[] = [];
    const fetcher = createMockFetcher({
      fetchPage: vi.fn().mockImplementation(() => {
        timestamps.push(Date.now());
        return Promise.resolve('<html></html>');
      }),
    });
    const extractor = createMockExtractor();
    const urls = ['https://example.com/a', 'https://example.com/b'];

    const articles = await collect(
      extractArticlesStream(urls)({ concurrency: 1, interval: 80, timeout: 5000 })({
        extractor,
        fetcher,
      })
    );

    expect(articles).toHaveLength(2);
    expect(timestamps).toHaveLength(2);
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(70);
  });

  it('yields nothing and does not fetch when urls is empty', async () => {
    const fetcher = createMockFetcher();
    const extractor = createMockExtractor();

    const articles = await collect(
      extractArticlesStream([])({ concurrency: 2, interval: 0, timeout: 5000 })({
        extractor,
        fetcher,
      })
    );

    expect(articles).toEqual([]);
    expect(fetcher.fetchPage).not.toHaveBeenCalled();
  });

  it('exposes progress without callbacks via the for-await loop', async () => {
    const fetcher = createMockFetcher({
      fetchPage: vi
        .fn()
        .mockImplementation((url: string) => Promise.resolve(`<html><body>${url}</body></html>`)),
    });
    const extractor = createMockExtractor({
      extract: vi.fn().mockImplementation((html: string) => ({ content: html, title: html })),
    });
    const urls = ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'];

    let yielded = 0;
    const seenDone: number[] = [];
    const gen = extractArticlesStream(urls)({ concurrency: 1, interval: 0, timeout: 5000 })({
      extractor,
      fetcher,
    });
    for await (const _article of gen) {
      yielded += 1;
      seenDone.push(yielded);
    }

    expect(seenDone).toEqual([1, 2, 3]);
  });

  it('cancels mid-stream when the caller breaks out of the loop', async () => {
    const fetcher = createMockFetcher({
      fetchPage: vi.fn().mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            setTimeout(() => resolve('<html></html>'), 10);
          })
      ),
    });
    const extractor = createMockExtractor();
    const urls = Array.from({ length: 5 }, (_, i) => `https://example.com/${i}`);

    const collected: Article[] = [];
    const gen = extractArticlesStream(urls)({ concurrency: 1, interval: 0, timeout: 5000 })({
      extractor,
      fetcher,
    });
    for await (const article of gen) {
      collected.push(article);
      break;
    }

    expect(collected).toHaveLength(1);
  });
});
