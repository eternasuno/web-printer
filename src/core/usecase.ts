import type { Article } from './entity';
import type { Dom, Extractor, Http, LinkInfo } from './port';

const isHttpUrl = (url: string): boolean =>
  url.startsWith('http://') || url.startsWith('https://');

const hostnameOf = (url: string): string | null => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

const isSameDomain =
  (url: string) =>
  (domain: string): boolean =>
    hostnameOf(url) === domain;

export const findLinks =
  (selector: string) =>
  (currentDomain: string) =>
  (dom: Dom): LinkInfo[] => {
    const raw = dom.findLinks(selector);
    const seen = new Set<string>();
    const links: LinkInfo[] = [];
    for (const link of raw) {
      if (!isHttpUrl(link.url)) continue;
      if (!isSameDomain(link.url)(currentDomain)) continue;
      if (seen.has(link.url)) continue;
      seen.add(link.url);
      links.push(link);
    }
    return links;
  };

type ExtractArticleDeps = {
  fetcher: Http;
  extractor: Extractor;
};

export const extractArticle =
  (url: string, timeout: number) =>
  async (deps: ExtractArticleDeps): Promise<Article> => {
    const html = await deps.fetcher.fetchPage(url, timeout);
    const { title, content } = deps.extractor.extract(html);
    return { content, title, url };
  };

type BatchConfig = {
  concurrency: number;
  interval: number;
  timeout: number;
};

export type { BatchConfig };

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  concurrency: 3,
  interval: 500,
  timeout: 30000,
};

const delay = (ms: number) => (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const runOne =
  (config: BatchConfig) =>
  (deps: ExtractArticleDeps) =>
  (url: string): Promise<Article | null> =>
    extractArticle(url, config.timeout)(deps).catch((): Article | null => null);

export const extractArticlesStream =
  (urls: string[]) =>
  (config: BatchConfig) =>
  (deps: ExtractArticleDeps): AsyncGenerator<Article> => {
    const limit = Math.max(1, config.concurrency);
    const slots: Promise<Article | null>[] = new Array(urls.length);
    let launched = 0;
    let first = true;

    const ensure = async (untilIndex: number): Promise<void> => {
      while (launched <= untilIndex && launched < urls.length) {
        if (!first) await delay(config.interval)();
        first = false;
        const index = launched;
        slots[index] = runOne(config)(deps)(urls[index]);
        launched += 1;
      }
    };

    return (async function* (): AsyncGenerator<Article> {
      for (let index = 0; index < urls.length; index++) {
        await ensure(index + limit - 1);
        const value = await slots[index];
        if (value) yield value;
      }
    })();
  };
