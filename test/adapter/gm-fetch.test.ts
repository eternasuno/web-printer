import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const fetchEffect = (
  pageUrl: string,
  timeout: number
): Effect.Effect<Tampermonkey.Response<undefined>, unknown> =>
  Effect.provide(
    Effect.gen(function* () {
      const fetcher = yield* PageFetcher;

      return yield* fetcher.fetch(pageUrl, timeout);
    }),
    PageFetcherLive
  );

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

describe('GM fetch adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a GET request and completes with the GM response', async () => {
    const request = stubRequest();
    const pending = Effect.runPromise(fetchEffect(url, timeoutMs));
    const details = await request.registered;

    expect(details.method).toBe('GET');
    expect(details.url).toBe(url);
    expect(details.timeout).toBe(timeoutMs);

    details.onload?.call(response(), response());
    details.ontimeout?.();

    await expect(pending).resolves.toMatchObject({ status: 200 });
    expect(request.abortCalls()).toBe(0);
  });

  it('fails with the GM error response', async () => {
    const request = stubRequest();
    const failure = errorResponse('boom');
    const pending = Effect.runPromise(fetchEffect(url, timeoutMs));
    const details = await request.registered;

    details.onerror?.call(failure, failure);

    expect(await pending.catch((cause: unknown) => cause)).toBe(failure);
    expect(request.abortCalls()).toBe(0);
  });

  it('turns a synchronous GM exception into an Effect failure', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', () => {
      throw new Error('GM unavailable');
    });

    await expect(
      Effect.runPromise(fetchEffect(url, timeoutMs))
    ).rejects.toThrow('GM unavailable');
  });

  it('fails with a Timeout error', async () => {
    const request = stubRequest();
    const pending = Effect.runPromise(fetchEffect(url, timeoutMs));
    const details = await request.registered;

    details.ontimeout?.();

    await expect(pending).rejects.toThrow('Timeout');
    expect(request.abortCalls()).toBe(0);
  });

  it('aborts the GM request when the effect is interrupted', async () => {
    const request = stubRequest();
    const controller = new AbortController();
    const pending = Effect.runPromise(fetchEffect(url, timeoutMs), {
      signal: controller.signal,
    });
    await request.registered;

    controller.abort();

    await expect(pending).rejects.toThrow(/interrupted/i);
    expect(request.abortCalls()).toBe(1);
  });

  it('aborts once and ignores late GM callbacks after interruption', async () => {
    const request = stubRequest();
    const controller = new AbortController();
    const pending = Effect.runPromise(fetchEffect(url, timeoutMs), {
      signal: controller.signal,
    });
    const details = await request.registered;

    controller.abort();
    await expect(pending).rejects.toThrow(/interrupted/i);

    details.onload?.call(response(), response({ status: 500 }));
    details.onerror?.call(errorResponse('late'), errorResponse('late'));
    details.ontimeout?.();

    expect(request.abortCalls()).toBe(1);
  });
});
