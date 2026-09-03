import { Effect } from 'effect';
import type {
  CollectedPage,
  CollectionProgress,
  SelectedPage,
} from '../entity';
import {
  ArticleExtractor,
  HtmlDocumentParser,
  HtmlSanitizer,
  type IArticleExtractor,
  type IHtmlDocumentParser,
  type IHtmlSanitizer,
  type IPageFetcher,
  PageFetcher,
} from '../port';

const CONCURRENCY = 4;
const TIMEOUT_MS = 10_000;
const SUCCESS_STATUS_START = 200;
const REDIRECT_STATUS_START = 300;

export type CollectServices =
  | IPageFetcher
  | IHtmlDocumentParser
  | IArticleExtractor
  | IHtmlSanitizer;

type Options = {
  readonly onProgress?: (progress: CollectionProgress) => void;
};

type FetchResponse = Effect.Success<ReturnType<IPageFetcher['fetch']>>;

const failed = (page: SelectedPage, reason: string): CollectedPage => ({
  type: 'failure',
  page,
  reason,
});

const contentType = (headers: string): string | null =>
  headers.match(/^content-type\s*:\s*([^\r\n]+)/im)?.[1]?.trim() ?? null;

const contentTypeAllowed = (contentType: string | null): boolean => {
  if (contentType === null) {
    return true;
  }

  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase();

  return mediaType === 'text/html' || mediaType === 'application/xhtml+xml';
};

const firstTitle = (
  ...values: readonly (string | null | undefined)[]
): string => values.find((value) => value?.trim())?.trim() ?? '';

const failureReason = (error: unknown): string =>
  error instanceof Error ? error.message : 'Network error';

const collected = (
  page: SelectedPage,
  response: FetchResponse,
  dependencies: {
    readonly parser: IHtmlDocumentParser;
    readonly extractor: IArticleExtractor;
    readonly sanitizer: IHtmlSanitizer;
  }
): CollectedPage => {
  const responseContentType = contentType(response.responseHeaders);
  const finalUrl = response.finalUrl || page.url;
  if (
    response.status < SUCCESS_STATUS_START ||
    response.status >= REDIRECT_STATUS_START
  ) {
    return failed(page, `HTTP ${response.status}`);
  }
  if (!contentTypeAllowed(responseContentType)) {
    return failed(page, `Unsupported content type: ${responseContentType}`);
  }

  const sourcePage = dependencies.parser.parse(response.responseText, finalUrl);
  const extracted = dependencies.extractor.extract(sourcePage);
  if (!extracted?.content?.trim()) {
    return failed(page, 'Readability returned no content');
  }

  const title = firstTitle(
    extracted.title,
    page.label,
    sourcePage.title,
    page.url
  );
  const contentHtml = dependencies.sanitizer.sanitize(extracted.content);
  if (!contentHtml.trim()) {
    return failed(page, 'Sanitized content is empty');
  }

  return {
    type: 'success',
    page,
    article: { title, contentHtml, sourceUrl: finalUrl },
  };
};

export const collectPage = (
  page: SelectedPage
): Effect.Effect<CollectedPage, never, CollectServices> =>
  Effect.gen(function* () {
    const dependencies = {
      parser: yield* HtmlDocumentParser,
      extractor: yield* ArticleExtractor,
      sanitizer: yield* HtmlSanitizer,
    };
    const fetcher = yield* PageFetcher;

    return yield* Effect.try({
      try: () => fetcher.fetch(page.url, TIMEOUT_MS),
      catch: (error) => error,
    }).pipe(
      Effect.flatten,
      Effect.flatMap((response) =>
        Effect.try({
          try: () => collected(page, response, dependencies),
          catch: (error) => error,
        })
      ),
      Effect.catch((error) =>
        Effect.succeed(failed(page, failureReason(error)))
      )
    );
  });

export const collect = (
  pages: readonly SelectedPage[],
  options: Options = {}
): Effect.Effect<readonly CollectedPage[], never, CollectServices> => {
  let completed = 0;

  return Effect.forEach(
    pages,
    (page) =>
      collectPage(page).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            completed += 1;
            options.onProgress?.({
              completed,
              total: pages.length,
              state: 'fetching',
            });
          })
        )
      ),
    { concurrency: CONCURRENCY }
  );
};
