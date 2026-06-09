import Readability from '@mozilla/readability';
import type { ExtractedPage, FetchResult } from '../core/entity';
import type { ContentExtractorPort } from '../core/port';

const extractOne = (page: FetchResult): ExtractedPage | null => {
  const doc = new DOMParser().parseFromString(page.html, 'text/html');
  const reader = new Readability(doc);
  const article = reader.parse();
  if (!article) return null;
  return { html: article.content ?? '', title: article.title ?? '', url: page.url };
};

export const createReadabilityExtractor = (): ContentExtractorPort => ({
  extractPages: (pages: FetchResult[]): ExtractedPage[] => {
    const results: ExtractedPage[] = [];
    for (const page of pages) {
      const extracted = extractOne(page);
      if (extracted) results.push(extracted);
    }
    return results;
  },
});
