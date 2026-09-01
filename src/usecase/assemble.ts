import type {
  CollectedPage,
  CollectionSummary,
  PrintDocument,
  PrintItem,
} from '../entity';

const itemFor = (result: CollectedPage, index: number): PrintItem => {
  const breakBefore = index > 0;
  if (result.type === 'success') {
    return {
      type: 'article',
      title: result.article.title,
      contentHtml: result.article.contentHtml,
      sourceUrl: result.article.sourceUrl ?? result.page.url,
      breakBefore,
    };
  }

  if (result.type === 'failure') {
    return {
      type: 'failure',
      label: result.page.label,
      url: result.page.url,
      reason: result.reason,
      breakBefore,
    };
  }

  return {
    type: 'cancelled',
    label: result.page.label,
    url: result.page.url,
    breakBefore,
  };
};

const summarize = (results: readonly CollectedPage[]): CollectionSummary => {
  const failures = results.flatMap((result) =>
    result.type === 'failure'
      ? [
          {
            label: result.page.label,
            url: result.page.url,
            reason: result.reason,
          },
        ]
      : []
  );

  return {
    succeeded: results.filter((result) => result.type === 'success').length,
    failed: failures.length,
    cancelled: results.filter((result) => result.type === 'cancelled').length,
    failures,
  };
};

export const assemble = (
  pageTitle: string,
  hostname: string,
  results: readonly CollectedPage[]
): PrintDocument => ({
  title: pageTitle.trim() || hostname,
  summary: summarize(results),
  items: results.map(itemFor),
});
