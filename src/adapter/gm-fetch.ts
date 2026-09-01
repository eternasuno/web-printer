import type { FetchResponse } from '../entity';
import type { PageFetcher } from '../port';

type GmResponse = {
  readonly status: number;
  readonly responseText: string;
  readonly responseHeaders: string;
  readonly finalUrl: string;
};

type RequestDetails = {
  readonly method: 'GET';
  readonly url: string;
  readonly timeout: number;
  readonly onload: (response: GmResponse) => void;
  readonly onerror: () => void;
  readonly ontimeout: () => void;
};

type Request = (details: RequestDetails) => unknown;

const contentType = (headers: string): string | null =>
  headers.match(/^content-type\s*:\s*([^\r\n]+)/im)?.[1]?.trim() ?? null;

export const createPageFetcher = (
  request: Request = GM_xmlhttpRequest as Request
): PageFetcher => ({
  fetch: (url, timeout) =>
    new Promise<FetchResponse>((resolve, reject) => {
      request({
        method: 'GET',
        url,
        timeout,
        onload: (response) => {
          resolve({
            status: response.status,
            contentType: contentType(response.responseHeaders),
            body: response.responseText,
            finalUrl: response.finalUrl || url,
          });
        },
        onerror: () => reject({ type: 'network', message: 'Network error' }),
        ontimeout: () => reject({ type: 'timeout' }),
      });
    }),
});
