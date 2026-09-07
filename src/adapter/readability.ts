import { Readability } from '@mozilla/readability';
import { Effect, Layer } from 'effect';
import { ArticleExtractor } from '../port';

export const ArticleExtractorLive = Layer.succeed(ArticleExtractor, {
  extract: (page) =>
    Effect.try({
      try: () => new Readability(page.cloneNode(true) as Document).parse(),
      catch: (error) =>
        error instanceof Error ? error : new Error(String(error)),
    }),
});
