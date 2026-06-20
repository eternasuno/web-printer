import { Readability } from '@mozilla/readability';
import type { Extractor } from '../core/port';

export const createReadabilityExtractor = (): Extractor => ({
  extract: (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const reader = new Readability(doc);
    const article = reader.parse();
    if (!article) throw new Error('No readable content found');
    return { content: article.content ?? '', title: article.title ?? '' };
  },
});
