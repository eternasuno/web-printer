import { Context } from 'effect';
import type {
  CandidateLink,
  CollectionProgress,
  ExtractedArticle,
  PageSnapshot,
  PrintDocument,
  SelectedPage,
} from './entity';

export interface IPageReader {
  readPage(): PageSnapshot;
}

export interface IPageFetcher {
  fetch(
    url: string,
    timeoutMs: number
  ): Promise<Tampermonkey.Response<undefined>>;
}

export const PageFetcher = Context.Service<IPageFetcher>(
  'web-printer/port/PageFetcher'
);

export interface IArticleExtractor {
  extract(html: string, url: string): ExtractedArticle | null;
}

export const ArticleExtractor = Context.Service<IArticleExtractor>(
  'web-printer/port/ArticleExtractor'
);

export interface IHtmlTransformer {
  transform(html: string, sourceUrl: string, title: string): string;
}

export const HtmlTransformer = Context.Service<IHtmlTransformer>(
  'web-printer/port/HtmlTransformer'
);

export interface IHtmlSanitizer {
  sanitize(html: string): string;
}

export const HtmlSanitizer = Context.Service<IHtmlSanitizer>(
  'web-printer/port/HtmlSanitizer'
);

export interface ILinkSelector {
  select(candidates: readonly CandidateLink[]): Promise<SelectedPage[] | null>;
}

export interface IPreview {
  update(progress: CollectionProgress): void;
  render(document: PrintDocument): void;
  isCancelled(): boolean;
  isClosed(): boolean;
}

export interface INotifier {
  show(message: string): void;
}

export interface IMenuRegistrar {
  register(label: string, handler: () => void): void;
}
