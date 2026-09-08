import type { Readability } from '@mozilla/readability';
import { Effect, Layer } from 'effect';
import type { Link } from '../../src/entity';
import {
  ArticleExtractor,
  HtmlDocumentParser,
  HtmlSanitizer,
  type IArticleExtractor,
  type IHtmlDocumentParser,
  type IHtmlSanitizer,
  type IPageFetcher,
  PageFetcher,
} from '../../src/port';

export type FetchResponse = Tampermonkey.Response<undefined>;

export const link = (id: number): Link => ({
  id,
  url: `https://docs.test/${id}`,
  label: `Page ${id}`,
  path: `/${id}`,
});

const fetchPage: IPageFetcher['fetch'] = () =>
  Effect.succeed({
    status: 200,
    responseHeaders: 'Content-Type: text/html',
    responseText: '<main><p>Body</p></main>',
    finalUrl: 'https://docs.test/final',
  } as FetchResponse);

export const PageFetcherLive = (
  fetch: IPageFetcher['fetch'] = fetchPage
): Layer.Layer<PageFetcher> => Layer.succeed(PageFetcher, { fetch });

const parseDocument: IHtmlDocumentParser['parse'] = (html, url) =>
  Effect.sync(() => {
    const page = new DOMParser().parseFromString(html, 'text/html');
    Object.defineProperty(page, 'URL', { value: url });
    page.title = 'Document';

    return page;
  });

export const HtmlDocumentParserLive = (
  parse: IHtmlDocumentParser['parse'] = parseDocument
): Layer.Layer<HtmlDocumentParser> =>
  Layer.succeed(HtmlDocumentParser, { parse });

const extractArticle: IArticleExtractor['extract'] = () =>
  Effect.succeed({
    title: 'Article',
    content: '<p>Body</p>',
  } as NonNullable<ReturnType<Readability['parse']>>);

export const ArticleExtractorLive = (
  extract: IArticleExtractor['extract'] = extractArticle
): Layer.Layer<ArticleExtractor> =>
  Layer.succeed(ArticleExtractor, { extract });

export const HtmlSanitizerLive = (
  sanitize: IHtmlSanitizer['sanitize'] = (html) => Effect.succeed(html)
): Layer.Layer<HtmlSanitizer> => Layer.succeed(HtmlSanitizer, { sanitize });

export const unreachable = (): Effect.Effect<never, Error> =>
  Effect.fail(new Error('stage reached'));
