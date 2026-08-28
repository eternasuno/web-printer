import type { Article, BatchResult, Failure, FailureCode, SourceLink } from './entity';

const limit = 200;
const cancelled = (): Error => Object.assign(new Error('Cancelled'), { code: 'cancelled' });
const failure = (url: string, code: FailureCode, error: unknown): Failure => ({
  url,
  code,
  message: error instanceof Error ? error.message : String(error),
});
export type DiscoverResult = SourceLink[] & { truncated: boolean };
export const discoverLinks = (
  xpath: string,
  pageUrl: string,
  findLinks: (xpath: string) => { text: string; href: string; downloadable?: boolean }[] = () => [],
): DiscoverResult => {
  if (!xpath.trim()) throw new Error('XPath is required');
  const raw = findLinks(xpath);
  const base = new URL(pageUrl);
  const seen = new Set<string>();
  const links = raw.flatMap((link) => {
    if (!link.href || link.downloadable) return [];
    let url: URL;
    try {
      url = new URL(link.href, base);
    } catch {
      return [];
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== base.origin ||
      url.username ||
      url.password
    )
      return [];
    url.hash = '';
    const normalized = url.href;
    if (seen.has(normalized)) return [];
    seen.add(normalized);
    return [{ text: link.text.trim() || normalized, url: normalized, selected: true }];
  });
  const result = links.slice(0, limit) as DiscoverResult;
  Object.defineProperty(result, 'truncated', { value: links.length > limit, enumerable: false });
  return result;
};

const batchConfig = { concurrency: 3, interval: 500, timeout: 30000 } as const;
export const runBatch = async (
  urls: string[],
  fetch: (url: string, signal: AbortSignal) => Promise<Article>,
  signal = new AbortController().signal,
  onProgress?: (value: {
    completed: number;
    succeeded: number;
    failed: number;
    total: number;
  }) => void,
): Promise<BatchResult> => {
  const articles: (Article | undefined)[] = new Array(urls.length);
  const failures: (Failure | undefined)[] = new Array(urls.length);
  let next = 0;
  let lastStart = -Infinity;
  let schedule: Promise<void> = Promise.resolve();
  const startSlot = async (): Promise<void> => {
    const slot = schedule.then(async () => {
      const delay = Math.max(0, batchConfig.interval - (Date.now() - lastStart));
      if (delay)
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          const abort = (): void => {
            clearTimeout(timer);
            reject(cancelled());
          };
          signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) abort();
        });
      if (signal.aborted) throw cancelled();
      lastStart = Date.now();
    });
    schedule = slot.catch(() => undefined);
    await slot;
  };
  const worker = async (): Promise<void> => {
    while (true) {
      if (signal.aborted) throw cancelled();
      const index = next++;
      if (index >= urls.length) return;
      await startSlot();
      const controller = new AbortController();
      const abort = (): void => controller.abort();
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) controller.abort();
      let timedOut = false;
      let timeoutReject!: (error: Error) => void;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutReject = reject;
      });
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        timeoutReject(Object.assign(new Error('Timeout'), { code: 'timeout' }));
      }, batchConfig.timeout);
      try {
        articles[index] = await Promise.race([
          fetch(urls[index], controller.signal),
          timeoutPromise,
        ]);
      } catch (error) {
        if (signal.aborted) throw cancelled();
        failures[index] = failure(
          urls[index],
          timedOut ? 'timeout' : ((error as { code?: FailureCode }).code ?? 'internal-error'),
          error,
        );
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      }
      onProgress?.({
        completed: articles.filter(Boolean).length + failures.filter(Boolean).length,
        succeeded: articles.filter(Boolean).length,
        failed: failures.filter(Boolean).length,
        total: urls.length,
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(batchConfig.concurrency, urls.length) }, worker));
  return {
    articles: articles.filter((item): item is Article => Boolean(item)),
    failures: failures.filter((item): item is Failure => Boolean(item)),
  };
};
