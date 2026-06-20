import type { Http } from '../core/port';

export const createGmFetcher = (): Http => ({
  fetchPage: (url: string, timeout: number): Promise<string> =>
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
        timeout,
        url,
      });
    }),
});
