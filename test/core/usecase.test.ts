import { describe, expect, it, vi } from 'vitest';
import { runBatch } from '../../src/core/usecase';

describe('runBatch', () => {
  const article = (url: string) => ({ title: url, content: '<p>x</p>' });

  it('preserves input order while recording failures in order', async () => {
    const result = await runBatch(['a', 'b', 'c'], async (url) => {
      if (url !== 'a')
        await new Promise((resolve) =>
          setTimeout(resolve, url === 'b' ? 15 : 1)
        );
      if (url === 'b')
        throw Object.assign(new Error('bad'), { code: 'network-error' });
      return article(url);
    });
    expect(result.articles.map((item) => item.title)).toEqual(['a', 'c']);
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
      (value) => progress.push(value.completed)
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
    expect(result.failures[0]?.code).toBe('timeout');
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
