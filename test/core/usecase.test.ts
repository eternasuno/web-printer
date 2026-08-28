import { describe, expect, it, vi } from 'vitest';
import { discoverLinks, runBatch } from '../../src/core/usecase';

const raw = (href: string, extra: { text?: string; downloadable?: boolean } = {}) => ({
  text: extra.text ?? href,
  href,
  downloadable: extra.downloadable,
});

describe('discoverLinks', () => {
  it.each([
    ['protocol', 'http://site.test/x', 'http://site.test/p'],
    ['subdomain', 'https://docs.site.test/x', 'https://docs.site.test/p'],
    ['port', 'https://site.test:8443/x', 'https://site.test:8443/p'],
    ['relative', 'https://site.test/guide/page', '../next'],
  ])('accepts same-origin %s and resolves URLs', (_, page, href) => {
    expect(discoverLinks('//a', page, () => [raw(href)])[0].url).toBe(new URL(href, page).href);
  });

  it('rejects protocol, subdomain, and port changes', () => {
    const links = discoverLinks('x', 'https://docs.site.test:443/a', () => [
      raw('http://docs.site.test/a'),
      raw('https://site.test/a'),
      raw('https://docs.site.test:444/a'),
    ]);
    expect(links).toEqual([]);
  });

  it('removes fragments and rejects credentials, downloads, and invalid URLs', () => {
    const links = discoverLinks('x', 'https://site.test/a', () => [
      raw('/a#part'),
      raw('/a#other'),
      raw('https://u:p@site.test/private'),
      raw('/file', { downloadable: true }),
      raw('javascript:bad'),
    ]);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://site.test/a');
  });

  it('deduplicates and limits results to 200', () => {
    const links = discoverLinks('x', 'https://site.test', () =>
      Array.from({ length: 205 }, (_, i) => raw(`/p${i % 201}`)),
    );
    expect(links).toHaveLength(200);
    expect(new Set(links.map((link) => link.url)).size).toBe(200);
  });

  it('rejects empty XPath and uses fallback text', () => {
    expect(() => discoverLinks('  ', location.href)).toThrow('XPath is required');
    expect(
      discoverLinks('x', 'https://site.test/a', () => [raw('/x', { text: '  ' })])[0].text,
    ).toBe('https://site.test/x');
  });
});

describe('runBatch', () => {
  const article = (url: string) => ({ title: url, content: '<p>x</p>', url });

  it('preserves input order while recording failures in order', async () => {
    const result = await runBatch(['a', 'b', 'c'], async (url) => {
      if (url !== 'a') await new Promise((resolve) => setTimeout(resolve, url === 'b' ? 15 : 1));
      if (url === 'b') throw Object.assign(new Error('bad'), { code: 'network-error' });
      return article(url);
    });
    expect(result.articles.map((item) => item.url)).toEqual(['a', 'c']);
    expect(result.failures.map((item) => item.url)).toEqual(['b']);
  });

  it('reports progress after each success and failure', async () => {
    const progress: number[] = [];
    await runBatch(
      ['a', 'b'],
      async (url) => {
        if (url === 'b') throw new Error('bad');
        return article(url);
      },
      undefined,
      (value) => progress.push(value.completed),
    );
    expect(progress).toEqual([1, 2]);
  });

  it('enforces concurrency', async () => {
    vi.useFakeTimers();
    let active = 0;
    let maximum = 0;
    const pending = runBatch(['a', 'b', 'c', 'd'], async (url) => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      active--;
      return article(url);
    });
    await vi.runAllTimersAsync();
    await pending;
    expect(maximum).toBe(3);
    vi.useRealTimers();
  });

  it('applies interval between jobs', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async (url: string) => article(url));
    const pending = runBatch(['a', 'b'], fetch);
    await vi.runAllTimersAsync();
    await pending;
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('times out and passes an abort signal to fetch', async () => {
    vi.useFakeTimers();
    let requestSignal!: AbortSignal;
    const pending = runBatch(['a'], async (_, signal) => {
      requestSignal = signal;
      return new Promise(() => undefined);
    });
    await vi.advanceTimersByTimeAsync(30000);
    const result = await pending;
    expect(requestSignal.aborted).toBe(true);
    expect(result.failures[0].code).toBe('timeout');
    vi.useRealTimers();
  });

  it('cancels active work and a cancellable interval delay', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetch = vi.fn(async (url: string) => article(url));
    const pending = runBatch(['a', 'b', 'c', 'd'], fetch, controller.signal);
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
