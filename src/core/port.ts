import type { ExtractedPage, FetchResult, LinkInfo, ProgressState } from './entity';

export type LinkFinderPort = {
  findLinks(selector: string): LinkInfo[];
};

export type PageFetcherPort = {
  fetchPages(urls: string[]): Promise<FetchResult[]>;
};

export type ContentExtractorPort = {
  extractPages(pages: FetchResult[]): ExtractedPage[];
};

export type PrintPort = {
  printHtml(html: string): Promise<void>;
};

export type ViewPort = {
  promptSelector(initialSelector?: string): Promise<string | null>;
  selectLinks(links: LinkInfo[]): Promise<string[] | null>;
  showProgress(state: ProgressState): void;
  removeProgress(): void;
  showToast(message: string): void;
  readonly cancelled: boolean;
};
