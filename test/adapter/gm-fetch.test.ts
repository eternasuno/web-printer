import { describe, expect, it, vi } from 'vitest';
import { createPageFetcher } from '../../src/adapter/gm-fetch';

type RequestDetails = {
  url: string;
  timeout: number;
  onload: (response: {
    status: number;
    responseText: string;
    responseHeaders: string;
    finalUrl: string;
  }) => void;
  onerror: () => void;
  ontimeout: () => void;
};

describe('GM fetch adapter', () => {
  it('maps a GM response to a project response', async () => {
    const request = vi.fn((details: RequestDetails) => {
      details.onload({
        status: 200,
        responseText: '<p>Body</p>',
        responseHeaders:
          'Content-Type: text/html; charset=utf-8\r\nX-Test: yes',
        finalUrl: 'https://docs.test/final',
      });

      return { abort: vi.fn() };
    });
    const fetcher = createPageFetcher(request);

    await expect(
      fetcher.fetch('https://docs.test/page', 20_000)
    ).resolves.toEqual({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<p>Body</p>',
      finalUrl: 'https://docs.test/final',
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'https://docs.test/page',
        timeout: 20_000,
      })
    );
  });

  it('maps network errors without applying business response rules', async () => {
    const fetcher = createPageFetcher((details: RequestDetails) => {
      details.onerror();

      return { abort: vi.fn() };
    });

    await expect(
      fetcher.fetch('https://docs.test/page', 20_000)
    ).rejects.toEqual({
      type: 'network',
      message: 'Network error',
    });
  });

  it('maps GM timeouts to the timeout failure type', async () => {
    const fetcher = createPageFetcher((details: RequestDetails) => {
      details.ontimeout();

      return { abort: vi.fn() };
    });

    await expect(
      fetcher.fetch('https://docs.test/page', 20_000)
    ).rejects.toEqual({
      type: 'timeout',
    });
  });

  it('does not retry a failed request', async () => {
    const request = vi.fn((details: RequestDetails) => {
      details.onerror();

      return { abort: vi.fn() };
    });
    const fetcher = createPageFetcher(request);

    await expect(
      fetcher.fetch('https://docs.test/page', 20_000)
    ).rejects.toBeDefined();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
