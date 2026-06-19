import type { Article } from './entity';

export type LinkInfo = {
  text: string;
  url: string;
};

export type Dom = {
  findLinks(selector: string): LinkInfo[];
};

export type Http = {
  fetchPage(url: string): Promise<string>;
};

export type Extractor = {
  extract(html: string): Pick<Article, 'title' | 'content'>;
};
