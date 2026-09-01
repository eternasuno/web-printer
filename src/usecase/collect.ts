import type {
  CollectedPage,
  CollectionProgress,
  SelectedPage,
} from '../entity';
import type {
  ArticleExtractor,
  HtmlSanitizer,
  HtmlTransformer,
  PageFetcher,
} from '../port';

const CONCURRENCY = 4;
const TIMEOUT_MS = 20_000;
const SUCCESS_STATUS_START = 200;
const REDIRECT_STATUS_START = 300;

export type CollectDependencies = {
  readonly fetcher: PageFetcher;
  readonly extractor: ArticleExtractor;
  readonly transformer: HtmlTransformer;
  readonly sanitizer: HtmlSanitizer;
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

export const collectPage = async (
  page: SelectedPage,
  dependencies: CollectDependencies
): Promise<CollectedPage> => {
  try {
    const response = await dependencies.fetcher.fetch(page.url, TIMEOUT_MS);
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

    const extracted = dependencies.extractor.extract(
      response.responseText,
      finalUrl
    );
    if (!extracted?.contentHtml.trim()) {
      return failed(page, 'Readability returned no content');
    }

    const title = firstTitle(
      extracted.title,
      page.label,
      extracted.documentTitle,
      page.url
    );
    const transformed = dependencies.transformer.transform(
      extracted.contentHtml,
      finalUrl,
      title
    );
    const contentHtml = dependencies.sanitizer.sanitize(transformed);
    if (!contentHtml.trim()) {
      return failed(page, 'Sanitized content is empty');
    }

    return {
      type: 'success',
      page,
      article: { title, contentHtml, sourceUrl: finalUrl },
    };
  } catch (error) {
    return failed(
      page,
      error instanceof Error ? error.message : 'Network error'
    );
  }
};

export const collect = async (
  pages: readonly SelectedPage[],
  dependencies: CollectDependencies,
  options: Options = {}
): Promise<CollectedPage[]> => {
  const results = new Array<CollectedPage>(pages.length);
  let next = 0;
  let completed = 0;

  const worker = async (): Promise<void> => {
    while (next < pages.length && !options.isCancelled?.()) {
      const index = next;
      next += 1;
      const page = pages[index];
      if (!page) {
        continue;
      }

      results[index] = await collectPage(page, dependencies);
      completed += 1;
      options.onProgress?.({
        completed,
        total: pages.length,
        state: options.isCancelled?.() ? 'cancelling' : 'fetching',
      });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pages.length) }, worker)
  );

  for (let index = 0; index < pages.length; index += 1) {
    if (!results[index]) {
      const page = pages[index];
      if (page) {
        results[index] = { type: 'cancelled', page };
      }
    }
  }

  return results;
};
