import { Readability } from '@mozilla/readability';
import { Layer } from 'effect';
import { ArticleExtractor } from '../port';

export const ArticleExtractorLive = Layer.succeed(ArticleExtractor, {
  extract: (html, url) => {
    const page = new DOMParser().parseFromString(html, 'text/html');
    const base = page.createElement('base');
    base.href = url;
    page.head.prepend(base);
    const documentTitle = page.title;
    const article = new Readability(page).parse();

    if (!article?.content?.trim()) {
      return null;
    }

    return {
      title: article.title?.trim() || null,
      documentTitle,
      contentHtml: article.content,
    };
  },
});
