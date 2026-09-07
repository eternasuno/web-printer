import type { Readability } from '@mozilla/readability';
import { Context, type Effect } from 'effect';

export interface IPageFetcher {
  fetch(
    url: string,
    timeoutMs: number
  ): Effect.Effect<Tampermonkey.Response<undefined>, Error>;
}

export interface IHtmlDocumentParser {
  parse(html: string, url: string): Effect.Effect<Document, Error>;
}

export interface IArticleExtractor {
  extract(
    page: Document
  ): Effect.Effect<ReturnType<Readability['parse']>, Error>;
}

export interface IHtmlSanitizer {
  sanitize(html: string): Effect.Effect<string, Error>;
}

export class PageFetcher extends Context.Service<PageFetcher, IPageFetcher>()(
  'PageFetcher'
) {}

export class HtmlDocumentParser extends Context.Service<
  HtmlDocumentParser,
  IHtmlDocumentParser
>()('HtmlDocumentParser') {}

export class ArticleExtractor extends Context.Service<
  ArticleExtractor,
  IArticleExtractor
>()('ArticleExtractor') {}

export class HtmlSanitizer extends Context.Service<
  HtmlSanitizer,
  IHtmlSanitizer
>()('HtmlSanitizer') {}
