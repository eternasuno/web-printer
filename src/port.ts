import type {
  CandidateLink,
  CollectionProgress,
  ExtractedArticle,
  PageSnapshot,
  PrintDocument,
  SelectedPage,
} from './entity';

export interface PageReader {
  readPage(): PageSnapshot;
}

export interface PageFetcher {
  fetch(
    url: string,
    timeoutMs: number
  ): Promise<Tampermonkey.Response<undefined>>;
}

export interface ArticleExtractor {
  extract(html: string, url: string): ExtractedArticle | null;
}

export interface HtmlTransformer {
  transform(html: string, sourceUrl: string, title: string): string;
}

export interface HtmlSanitizer {
  sanitize(html: string): string;
}

export interface LinkSelector {
  select(candidates: readonly CandidateLink[]): Promise<SelectedPage[] | null>;
}

export interface Preview {
  update(progress: CollectionProgress): void;
  render(document: PrintDocument): void;
  isCancelled(): boolean;
  isClosed(): boolean;
}

export interface Notifier {
  show(message: string): void;
}

export interface MenuRegistrar {
  register(label: string, handler: () => void): void;
}
