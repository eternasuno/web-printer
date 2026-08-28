import type { PageResponse } from '../core/port';

export const fetchPage = (url: string, signal: AbortSignal): Promise<PageResponse> =>
  new Promise((resolve, reject) => {
    let settled = false;
    let request: Tampermonkey.AbortHandle<void>;
    const onAbort = (): void => {
      if (finish()) {
        request.abort();
        reject(Object.assign(new Error('Cancelled'), { code: 'cancelled' }));
      }
    };
    const finish = (): boolean => {
      if (settled) return false;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      return true;
    };
    const fail = (error: Error, code: string): void => {
      if (finish()) reject(Object.assign(error, { code }));
    };
    request = GM_xmlhttpRequest({
      method: 'GET',
      url,
      onload: (response) => {
        if (!finish()) return;
        const contentType =
          response.responseHeaders
            .match(/^content-type\s*:\s*([^;\r\n]+)/im)?.[1]
            ?.trim()
            .toLowerCase() ?? '';
        resolve({ ...response, contentType });
      },
      onerror: () => fail(new Error('Network error'), 'network-error'),
      onabort: () => fail(new Error('Cancelled'), 'cancelled'),
    });
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
