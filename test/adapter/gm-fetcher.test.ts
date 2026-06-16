import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGmFetcher } from '../../src/adapter/gm-fetcher';

const mockResponses: Record<string, { status: number; body: string }> = {};

const createGmMock = () =>
  vi
    .fn()
    .mockImplementation(
      (details: {
        url: string;
        onload?: (r: { responseText: string; status: number }) => void;
        onerror?: (e: { error: string }) => void;
        ontimeout?: () => void;
      }) => {
        const resp = mockResponses[details.url];
        if (resp) {
          details.onload?.({ responseText: resp.body, status: resp.status });
        } else {
          details.onerror?.({ error: 'Network error' });
        }
      }
    );

beforeEach(() => {
  (globalThis as Record<string, unknown>).GM_xmlhttpRequest = createGmMock();
  for (const key of Object.keys(mockResponses)) {
    delete mockResponses[key];
  }
});

describe('fetchPage', () => {
  it('fetches a single page and returns HTML', async () => {
    mockResponses['https://example.com/a'] = { body: '<html>A</html>', status: 200 };
    const html = await createGmFetcher().fetchPage('https://example.com/a');
    expect(html).toBe('<html>A</html>');
  });

  it('throws on network error', async () => {
    await expect(createGmFetcher().fetchPage('https://example.com/missing')).rejects.toThrow(
      'Network error'
    );
  });

  it('throws on HTTP error', async () => {
    mockResponses['https://example.com/404'] = { body: 'Not found', status: 404 };
    await expect(createGmFetcher().fetchPage('https://example.com/404')).rejects.toThrow(
      'HTTP 404'
    );
  });
});
