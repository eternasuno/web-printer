import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGmFetcher } from '../../src/adapter/gm-fetcher';
import type { FetchResult } from '../../src/core/entity';

const mockResponses: Record<string, { status: number; body: string }> = {};

const createGmMock = () =>
  vi
    .fn()
    .mockImplementation(
      (details: {
        url: string;
        onload: (r: { responseText: string; status: number }) => void;
        onerror: (e: { error: string }) => void;
      }) => {
        const resp = mockResponses[details.url];
        if (resp) {
          details.onload({ responseText: resp.body, status: resp.status });
        } else {
          details.onerror({ error: 'Network error' });
        }
      }
    );

beforeEach(() => {
  (globalThis as Record<string, unknown>).GM_xmlhttpRequest = createGmMock();
});

describe('fetchPages', () => {
  it('fetches multiple pages concurrently', async () => {
    mockResponses['https://example.com/a'] = { body: '<html>A</html>', status: 200 };
    mockResponses['https://example.com/b'] = { body: '<html>B</html>', status: 200 };

    const results = await createGmFetcher().fetchPages([
      'https://example.com/a',
      'https://example.com/b',
    ]);
    expect(results).toHaveLength(2);
    expect(results.every((r: FetchResult) => r.ok)).toBe(true);
  });

  it('handles failed requests', async () => {
    const results = await createGmFetcher().fetchPages(['https://example.com/missing']);
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
    expect(results[0].error).toBe('Network error');
  });

  it('handles HTTP errors', async () => {
    mockResponses['https://example.com/404'] = { body: 'Not found', status: 404 };
    const results = await createGmFetcher().fetchPages(['https://example.com/404']);
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
    expect(results[0].error).toBe('HTTP 404');
  });
});
