import type { Readability } from '@mozilla/readability';
import { Context, type Effect } from 'effect';

export interface IPageFetcher {
  fetch(
    url: string,
    timeoutMs: number
  ): Effect.Effect<Tampermonkey.Response<undefined>, unknown>;
}

export interface IHtmlDocumentParser {
  parse(html: string, url: string): Document;
}

export interface IArticleExtractor {
  extract(page: Document): ReturnType<Readability['parse']>;
}

export interface IHtmlSanitizer {
  sanitize(html: string): string;
}

export const PageFetcher = Context.Service<IPageFetcher>('PageFetcher');
export const HtmlDocumentParser =
  Context.Service<IHtmlDocumentParser>('HtmlDocumentParser');
export const ArticleExtractor =
  Context.Service<IArticleExtractor>('ArticleExtractor');
export const HtmlSanitizer = Context.Service<IHtmlSanitizer>('HtmlSanitizer');
