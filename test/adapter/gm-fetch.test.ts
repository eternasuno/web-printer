import { afterEach, expect, it, vi } from '@effect/vitest';
import { Effect, Exit, Fiber } from 'effect';
import { PageFetcherLive } from '../../src/adapter/gm-fetch';
import { PageFetcher } from '../../src/port';

const url = 'https://docs.test/guide';
const timeoutMs = 10_000;

const response = (
  values: Partial<Tampermonkey.Response<undefined>> = {}
): Tampermonkey.Response<undefined> =>
  ({
    status: 200,
    responseHeaders: 'Content-Type: text/html',
    responseText: '<p>Body</p>',
    finalUrl: url,
    ...values,
  }) as Tampermonkey.Response<undefined>;

const errorResponse = (error: string): Tampermonkey.ErrorResponse =>
  ({ status: 0, statusText: '', error }) as Tampermonkey.ErrorResponse;

// Stubs GM_xmlhttpRequest and resolves with the details of the request the
// adapter registered, so tests can drive its listeners by hand.
const stubRequest = (): {
  readonly abortCalls: () => number;
  readonly registered: Promise<Tampermonkey.Request<undefined>>;
} => {
  const abort = vi.fn();
  let resolveRegistered: (details: Tampermonkey.Request<undefined>) => void;
  const registered = new Promise<Tampermonkey.Request<undefined>>((resolve) => {
    resolveRegistered = resolve;
  });
  vi.stubGlobal(
    'GM_xmlhttpRequest',
    (details: Tampermonkey.Request<undefined>) => {
      resolveRegistered(details);
      return { abort };
    }
  );

  return { abortCalls: () => abort.mock.calls.length, registered };
};

const fetchEffect = (pageUrl: string, timeout: number) =>
  Effect.gen(function* () {
    const fetcher = yield* PageFetcher;

    return yield* fetcher.fetch(pageUrl, timeout);
  });

it.layer(PageFetcherLive)('GM fetch adapter', (it) => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect('sends a GET request and completes with the GM response', () =>
    Effect.gen(function* () {
      const request = stubRequest();
      const fiber = yield* Effect.forkChild(fetchEffect(url, timeoutMs));
      const details = yield* Effect.promise(() => request.registered);

      expect(details.method).toBe('GET');
      expect(details.url).toBe(url);
      expect(details.timeout).toBe(timeoutMs);

      details.onload?.call(response(), response());
      details.ontimeout?.();

      expect(yield* Fiber.join(fiber)).toMatchObject({ status: 200 });
      expect(request.abortCalls()).toBe(0);
    })
  );

  it.effect('fails with the GM error response', () =>
    Effect.gen(function* () {
      const request = stubRequest();
      const failure = errorResponse('boom');
      const fiber = yield* Effect.forkChild(fetchEffect(url, timeoutMs));
      const details = yield* Effect.promise(() => request.registered);

      details.onerror?.call(failure, failure);

      const error = yield* Effect.flip(Fiber.join(fiber));

      expect(error.message).toBe('boom');
      expect(request.abortCalls()).toBe(0);
    })
  );

  it.effect('turns a synchronous GM exception into an Effect failure', () =>
    Effect.gen(function* () {
      vi.stubGlobal('GM_xmlhttpRequest', () => {
        throw new Error('GM unavailable');
      });

      const error = yield* Effect.flip(fetchEffect(url, timeoutMs));

      expect(error.message).toBe('GM unavailable');
    })
  );

  it.effect('fails with a Timeout error', () =>
    Effect.gen(function* () {
      const request = stubRequest();
      const fiber = yield* Effect.forkChild(fetchEffect(url, timeoutMs));
      const details = yield* Effect.promise(() => request.registered);

      details.ontimeout?.();

      const error = yield* Effect.flip(Fiber.join(fiber));

      expect(error.message).toBe('Timeout');
      expect(request.abortCalls()).toBe(0);
    })
  );

  it.effect('aborts the GM request when the effect is interrupted', () =>
    Effect.gen(function* () {
      const request = stubRequest();
      const fiber = yield* Effect.forkChild(fetchEffect(url, timeoutMs));
      yield* Effect.promise(() => request.registered);

      yield* Fiber.interrupt(fiber);
      const exit = yield* Effect.exit(Fiber.join(fiber));

      expect(Exit.hasInterrupts(exit)).toBe(true);
      expect(request.abortCalls()).toBe(1);
    })
  );

  it.effect(
    'aborts once and ignores late GM callbacks after interruption',
    () =>
      Effect.gen(function* () {
        const request = stubRequest();
        const fiber = yield* Effect.forkChild(fetchEffect(url, timeoutMs));
        const details = yield* Effect.promise(() => request.registered);

        yield* Fiber.interrupt(fiber);

        details.onload?.call(response(), response({ status: 500 }));
        details.onerror?.call(errorResponse('late'), errorResponse('late'));
        details.ontimeout?.();

        expect(request.abortCalls()).toBe(1);
      })
  );
});
