import type {
  CollectedPage,
  CollectionProgress,
  FetchFailure,
  SelectedPage,
} from '../entity';
import type {
  ArticleExtractor,
  HtmlSanitizer,
  HtmlTransformer,
  PageFetcher,
} from '../port';

const concurrency = 4;
const timeoutMs = 20_000;
const successStatusStart = 200;
const redirectStatusStart = 300;

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

const errorReason = (error: unknown): string => {
  const failure = error as Partial<FetchFailure>;
  if (failure.type === 'timeout') {
    return 'Timeout';
  }
  if (failure.type === 'network') {
    return failure.message || 'Network error';
  }

  return error instanceof Error ? error.message : 'Unexpected error';
};

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
    const response = await dependencies.fetcher.fetch(page.url, timeoutMs);
    if (
      response.status < successStatusStart ||
      response.status >= redirectStatusStart
    ) {
      return failed(page, `HTTP ${response.status}`);
    }
    if (!contentTypeAllowed(response.contentType)) {
      return failed(page, `Unsupported content type: ${response.contentType}`);
    }

    const extracted = dependencies.extractor.extract(
      response.body,
      response.finalUrl
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
      response.finalUrl,
      title
    );
    const contentHtml = dependencies.sanitizer.sanitize(transformed);
    if (!contentHtml.trim()) {
      return failed(page, 'Sanitized content is empty');
    }

    return {
      type: 'success',
      page,
      article: { title, contentHtml, sourceUrl: response.finalUrl },
    };
  } catch (error) {
    return failed(page, errorReason(error));
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
    Array.from({ length: Math.min(concurrency, pages.length) }, worker)
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
