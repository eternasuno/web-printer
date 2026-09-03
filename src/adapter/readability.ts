import { Readability } from '@mozilla/readability';
import { Layer } from 'effect';
import { ArticleExtractor } from '../port';

export const ArticleExtractorLive = Layer.succeed(ArticleExtractor, {
  extract: (page) => new Readability(page.cloneNode(true) as Document).parse(),
});
