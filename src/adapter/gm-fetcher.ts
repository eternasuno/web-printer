import type { Http } from '../core/port';

type GmRequest = {
  url: string;
  onload?: (res: { responseText: string; status: number }) => void;
  onerror?: (err: { error: string }) => void;
  method?: string;
};

declare function GM_xmlhttpRequest(details: GmRequest): void;

export const createGmFetcher = (): Http => ({
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
        url,
      });
    }),
});
