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

export const createGmFetcher = (): PageFetcherPort => ({
  fetchPage: (url: string): Promise<string> =>
    new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        onerror: (err) => reject(new Error(err.error || 'Network error')),
        onload: (res) => {
          if (res.status >= 200 && res.status < 400) {
            resolve(res.responseText);
          } else {
            reject(new Error(`HTTP ${res.status}`));
          }
        },
        ontimeout: () => reject(new Error('Timeout')),
        timeout: FETCH_TIMEOUT,
        url,
      });
    }),
});
