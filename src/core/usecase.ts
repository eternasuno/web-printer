import type { Article } from './entity';
import type { ContentExtractorPort, DomPort, LinkInfo, PageFetcherPort } from './port';

const isHttpUrl = (url: string): boolean =>
  url.startsWith('http://') || url.startsWith('https://');

export const findLinks =
  (selector: string) =>
  (dom: DomPort): LinkInfo[] => {
    const raw = dom.findLinks(selector);
    const seen = new Set<string>();
    const links: LinkInfo[] = [];
    for (const link of raw) {
      if (!isHttpUrl(link.url)) continue;
      if (seen.has(link.url)) continue;
      seen.add(link.url);
      links.push(link);
    }
    return links;
  };

type ExtractArticleDeps = {
  fetcher: PageFetcherPort;
  extractor: ContentExtractorPort;
};

export const extractArticle =
  (url: string) =>
  async (deps: ExtractArticleDeps): Promise<Article> => {
    const html = await deps.fetcher.fetchPage(url);
    const { title, content } = deps.extractor.extract(html);
    return { content, title, url };
  };
