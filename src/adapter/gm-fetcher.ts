import type { FetchResult } from '../core/entity';
import type { PageFetcherPort } from '../core/port';

type GmRequest = {
  url: string;
  onload?: (res: { responseText: string; status: number }) => void;
  onerror?: (err: { error: string }) => void;
  ontimeout?: () => void;
  method?: string;
  timeout?: number;
};

declare function GM_xmlhttpRequest(details: GmRequest): void;

const FETCH_TIMEOUT = 30000;
const CONCURRENCY = 3;

const fetchOne = (url: string): Promise<FetchResult> =>
  new Promise((resolve) => {
    GM_xmlhttpRequest({
      method: 'GET',
      onerror: (err) =>
        resolve({ error: err.error || 'Network error', html: '', ok: false, url }),
      onload: (res) =>
        resolve({
          error: res.status >= 400 ? `HTTP ${res.status}` : undefined,
          html: res.responseText,
          ok: res.status >= 200 && res.status < 400,
          url,
        }),
      ontimeout: () => resolve({ error: 'Timeout', html: '', ok: false, url }),
      timeout: FETCH_TIMEOUT,
      url,
    });
  });

const batchChunks =
  (size: number) =>
  <T>(arr: T[]): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

export const createGmFetcher = (): PageFetcherPort => ({
  fetchPages: async (urls: string[]): Promise<FetchResult[]> => {
    const results: FetchResult[] = [];
    const batches = batchChunks(CONCURRENCY)(urls);
    for (const batch of batches) {
      const batchResults = await Promise.all(batch.map(fetchOne));
      results.push(...batchResults);
    }
    return results;
  },
});
