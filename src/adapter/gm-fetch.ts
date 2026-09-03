import { Layer } from 'effect';
import { PageFetcher } from '../port';

export const PageFetcherLive = Layer.succeed(PageFetcher, {
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
