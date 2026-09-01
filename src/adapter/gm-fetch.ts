import type { PageFetcher } from '../port';

export const createPageFetcher = (): PageFetcher => ({
  fetch: (url, timeout) =>
    new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        timeout,
        onload: resolve,
        onerror: reject,
        ontimeout: () => reject(new Error('Timeout')),
      });
    }),
});
