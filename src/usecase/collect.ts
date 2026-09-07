import { Effect } from 'effect';
import type { Link, Post } from '../entity';
import {
  ArticleExtractor,
  HtmlDocumentParser,
  HtmlSanitizer,
  PageFetcher,
} from '../port';

export type CollectServices =
  | PageFetcher
  | HtmlDocumentParser
  | ArticleExtractor
  | HtmlSanitizer;

const CONCURRENCY = 4;
const TIMEOUT_MS = 10_000;
const SUCCESS_STATUS_START = 200;
const REDIRECT_STATUS_START = 300;

type FetchedPage = {
  readonly url: string;
  readonly html: string;
};

type ExtractedArticle = {
  readonly articleTitle: string | null | undefined;
  readonly documentTitle: string;
  readonly content: string;
};

type CollectionProgress = {
  readonly completed: number;
  readonly total: number;
};

type Options = {
  readonly onProgress?: (progress: CollectionProgress) => void;
};

const contentType = (headers: string): string | null =>
  headers
    .match(/^content-type\s*:\s*([^\r\n]+)/im)
    ?.at(1)
    ?.trim() ?? null;

const statusAllowed = (status: number): boolean =>
  status >= SUCCESS_STATUS_START && status < REDIRECT_STATUS_START;

const contentTypeAllowed = (contentType: string | null): boolean => {
  if (contentType === null) {
    return true;
  }

  const mediaType = contentType.split(';', 1).at(0)?.trim().toLowerCase();

  return mediaType === 'text/html' || mediaType === 'application/xhtml+xml';
};

const firstTitle = (
  ...values: readonly (string | null | undefined)[]
): string => values.find((value) => value?.trim())?.trim() ?? '';

const fetchPage = (
  link: Link
): Effect.Effect<FetchedPage, Error, PageFetcher> =>
  Effect.gen(function* () {
    const fetcher = yield* PageFetcher;
    const response = yield* fetcher.fetch(link.url, TIMEOUT_MS);
    const responseContentType = contentType(response.responseHeaders);

    if (!statusAllowed(response.status)) {
      return yield* Effect.fail(new Error(`HTTP ${response.status}`));
    }

    if (!contentTypeAllowed(responseContentType)) {
      return yield* Effect.fail(
        new Error(`Unsupported content type: ${responseContentType}`)
      );
    }

    return { url: response.finalUrl || link.url, html: response.responseText };
  });

const extractArticle = (
  url: string,
  html: string
): Effect.Effect<
  ExtractedArticle,
  Error,
  HtmlDocumentParser | ArticleExtractor
> =>
  Effect.gen(function* () {
    const parser = yield* HtmlDocumentParser;
    const extractor = yield* ArticleExtractor;
    const page = yield* parser.parse(html, url);
    const article = yield* extractor.extract(page);
    const content = article?.content;

    if (!content?.trim()) {
      return yield* Effect.fail(new Error('Readability returned no content'));
    }

    return {
      articleTitle: article?.title,
      documentTitle: page.title,
      content,
    };
  });

const sanitizeContent = (
  content: string
): Effect.Effect<string, Error, HtmlSanitizer> =>
  Effect.gen(function* () {
    const sanitizer = yield* HtmlSanitizer;
    const html = yield* sanitizer.sanitize(content);

    if (!html.trim()) {
      return yield* Effect.fail(new Error('Sanitized content is empty'));
    }

    return html;
  });

export const collectPage = (
  link: Link
): Effect.Effect<Post, never, CollectServices> =>
  Effect.gen(function* () {
    const page = yield* fetchPage(link);
    const article = yield* extractArticle(page.url, page.html);
    const contentHtml = yield* sanitizeContent(article.content);

    return {
      type: 'success' as const,
      link,
      title: firstTitle(
        article.articleTitle,
        link.label,
        article.documentTitle,
        link.url
      ),
      contentHtml,
      sourceUrl: page.url,
    };
  }).pipe(
    Effect.catch((error) =>
      Effect.succeed<Post>({
        type: 'failure',
        link,
        reason: error.message,
      })
    )
  );

export const collect = (
  links: readonly Link[],
  options: Options = {}
): Effect.Effect<readonly Post[], never, CollectServices> => {
  let completed = 0;

  return Effect.forEach(
    links,
    (link) =>
      collectPage(link).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            completed += 1;
            options.onProgress?.({
              completed,
              total: links.length,
            });
          })
        )
      ),
    { concurrency: CONCURRENCY }
  );
};
