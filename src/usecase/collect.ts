import { Effect } from 'effect';
import type {
  CollectedPage,
  CollectionProgress,
  SelectedPage,
} from '../entity';
import {
  ArticleExtractor,
  HtmlSanitizer,
  HtmlTransformer,
  type IArticleExtractor,
  type IHtmlSanitizer,
  type IHtmlTransformer,
  type IPageFetcher,
  PageFetcher,
} from '../port';

const CONCURRENCY = 4;
const TIMEOUT_MS = 20_000;
const SUCCESS_STATUS_START = 200;
const REDIRECT_STATUS_START = 300;

export type CollectServices =
  | IPageFetcher
  | IArticleExtractor
  | IHtmlTransformer
  | IHtmlSanitizer;

type Adapters = {
  readonly extractor: IArticleExtractor;
  readonly transformer: IHtmlTransformer;
  readonly sanitizer: IHtmlSanitizer;
};

type Options = {
  readonly isCancelled?: () => boolean;
  readonly onProgress?: (progress: CollectionProgress) => void;
};

const failed = (page: SelectedPage, reason: string): CollectedPage => ({
  type: 'failure',
  page,
  reason,
});

const cancelled = (page: SelectedPage): CollectedPage => ({
  type: 'cancelled',
  page,
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

const collectPageContent = (
  page: SelectedPage,
  response: Tampermonkey.Response<undefined>,
  adapters: Adapters
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

  const extracted = adapters.extractor.extract(response.responseText, finalUrl);
  if (!extracted?.contentHtml.trim()) {
    return failed(page, 'Readability returned no content');
  }

  const title = firstTitle(
    extracted.title,
    page.label,
    extracted.documentTitle,
    page.url
  );
  const transformed = adapters.transformer.transform(
    extracted.contentHtml,
    finalUrl,
    title
  );
  const contentHtml = adapters.sanitizer.sanitize(transformed);
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
    const fetcher = yield* PageFetcher;
    const extractor = yield* ArticleExtractor;
    const transformer = yield* HtmlTransformer;
    const sanitizer = yield* HtmlSanitizer;

    return yield* Effect.tryPromise({
      try: () => fetcher.fetch(page.url, TIMEOUT_MS),
      catch: (error) => error,
    }).pipe(
      Effect.flatMap((response) =>
        Effect.try({
          try: () =>
            collectPageContent(page, response, {
              extractor,
              transformer,
              sanitizer,
            }),
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

  const collectPageIfNeeded = (
    page: SelectedPage
  ): Effect.Effect<CollectedPage, never, CollectServices> =>
    options.isCancelled?.()
      ? Effect.succeed(cancelled(page))
      : collectPage(page).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              completed += 1;
              options.onProgress?.({
                completed,
                total: pages.length,
                state: options.isCancelled?.() ? 'cancelling' : 'fetching',
              });
            })
          )
        );

  return Effect.forEach(pages, collectPageIfNeeded, {
    concurrency: CONCURRENCY,
  });
};
