import type { Article } from './entity';

export type LinkInfo = {
  text: string;
  url: string;
};

export type DomPort = {
  findLinks(selector: string): LinkInfo[];
};

export type PageFetcherPort = {
  fetchPage(url: string): Promise<string>;
};

export type ContentExtractorPort = {
  extract(html: string): Pick<Article, 'title' | 'content'>;
};
