import type { Article, BatchResult, Failure, FailureCode } from './entity';

const cancelled = (): Error =>
  Object.assign(new Error('Cancelled'), { code: 'cancelled' });
const codeOf = (error: unknown): FailureCode =>
  (error as { code?: FailureCode }).code ?? 'internal-error';
const failure = (url: string, code: FailureCode, error: unknown): Failure => ({
  url,
  code,
  message: error instanceof Error ? error.message : String(error),
});
const batchConfig = { concurrency: 3, interval: 500, timeout: 30000 } as const;

type PageLoader = (url: string, signal: AbortSignal) => Promise<Article>;
type ProgressValue = {
  completed: number;
  succeeded: number;
  failed: number;
  total: number;
};

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const abort = (): void => {
      clearTimeout(timer);
      reject(cancelled());
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });

const createThrottle = (
  signal: AbortSignal,
  interval: number
): (() => Promise<void>) => {
  let lastStart = -Infinity;
  let schedule: Promise<void> = Promise.resolve();
  const gate = async (): Promise<void> => {
    const delay = Math.max(0, interval - (Date.now() - lastStart));
    if (delay) await sleep(delay, signal);
    if (signal.aborted) throw cancelled();
    lastStart = Date.now();
  };
  return () => {
    const slot = schedule.then(gate);
    schedule = slot.catch(() => undefined);
    return slot;
  };
};

const fetchWithTimeout = async (
  load: PageLoader,
  url: string,
  signal: AbortSignal,
  timeout: number
): Promise<Article> => {
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  let expired = false;
  let rejectTimeout!: (error: Error) => void;
  const timeoutPromise = new Promise<never>((_, reject) => {
    rejectTimeout = reject;
  });
  const timer = setTimeout(() => {
    expired = true;
    controller.abort();
    rejectTimeout(Object.assign(new Error('Timeout'), { code: 'timeout' }));
  }, timeout);
  try {
    return await Promise.race([load(url, controller.signal), timeoutPromise]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw Object.assign(new Error(message), {
      code: expired ? 'timeout' : codeOf(error),
    });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
};

export const runBatch = async (
  urls: string[],
  fetch: PageLoader,
  signal = new AbortController().signal,
  onProgress?: (value: ProgressValue) => void
): Promise<BatchResult> => {
  const articles: (Article | undefined)[] = new Array(urls.length);
  const failures: (Failure | undefined)[] = new Array(urls.length);
  let next = 0;
  const throttle = createThrottle(signal, batchConfig.interval);
  const report = (): void => {
    if (!onProgress) return;
    const succeeded = articles.filter(Boolean).length;
    const failed = failures.filter(Boolean).length;
    onProgress({
      completed: succeeded + failed,
      succeeded,
      failed,
      total: urls.length,
    });
  };
  const process = async (index: number, url: string): Promise<void> => {
    await throttle();
    try {
      articles[index] = await fetchWithTimeout(
        fetch,
        url,
        signal,
        batchConfig.timeout
      );
    } catch (error) {
      if (signal.aborted) throw cancelled();
      failures[index] = failure(url, codeOf(error), error);
    }
    report();
  };
  const worker = async (): Promise<void> => {
    while (true) {
      if (signal.aborted) throw cancelled();
      const index = next++;
      const url = urls[index];
      if (url === undefined) return;
      await process(index, url);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(batchConfig.concurrency, urls.length) },
      worker
    )
  );
  return {
    articles: articles.filter((item): item is Article => Boolean(item)),
    failures: failures.filter((item): item is Failure => Boolean(item)),
  };
};
