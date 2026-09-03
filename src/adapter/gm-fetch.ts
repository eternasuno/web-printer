import { Effect, Layer } from 'effect';
import { PageFetcher } from '../port';

export const PageFetcherLive = Layer.succeed(PageFetcher, {
  fetch: (url, timeout) =>
    Effect.callback<Tampermonkey.Response<undefined>, unknown>((resume) => {
      try {
        const request = GM_xmlhttpRequest({
          method: 'GET',
          url,
          timeout,
          onload: (response) => resume(Effect.succeed(response)),
          onerror: (error) => resume(Effect.fail(error)),
          ontimeout: () => resume(Effect.fail(new Error('Timeout'))),
        });

        return Effect.sync(() => request.abort());
      } catch (error) {
        resume(Effect.fail(error));
      }
    }),
});
