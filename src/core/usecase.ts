import type { Article } from './entity';
import type { ContentExtractorPort, DomPort, LinkInfo, PageFetcherPort } from './port';

export const findLinks = (dom: DomPort, selector: string): LinkInfo[] =>
  dom.findLinks(selector);

export const extractArticle = async (
  fetcher: PageFetcherPort,
  extractor: ContentExtractorPort,
  url: string,
): Promise<Article> => {
  const html = await fetcher.fetchPage(url);
  const { title, content } = extractor.extract(html);
  return { url, title, content };
};