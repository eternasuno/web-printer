import type { Readability } from '@mozilla/readability';
import { Effect, Layer } from 'effect';
import type { Link, Post } from '../../src/entity';
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
import { type CollectServices, collectPage } from '../../src/usecase/collect';

export type FetchResponse = Tampermonkey.Response<undefined>;

export type Stub = {
  fetcher: IPageFetcher;
  parser: IHtmlDocumentParser;
  extractor: IArticleExtractor;
  sanitizer: IHtmlSanitizer;
};

export const link = (id: number): Link => ({
  id,
  url: `https://docs.test/${id}`,
  label: `Page ${id}`,
  path: `/${id}`,
});

export const response = (values: Partial<FetchResponse> = {}): FetchResponse =>
  ({
    status: 200,
    responseHeaders: 'Content-Type: text/html',
    responseText: '<main><p>Body</p></main>',
    finalUrl: 'https://docs.test/final',
    ...values,
  }) as FetchResponse;

export const article = (
  title: string | null = 'Article',
  content = '<p>Body</p>'
): NonNullable<ReturnType<Readability['parse']>> =>
  ({ title, content }) as NonNullable<ReturnType<Readability['parse']>>;

export const parseDocument = (html: string, url: string): Document => {
  const page = new DOMParser().parseFromString(html, 'text/html');
  Object.defineProperty(page, 'URL', { value: url });
  page.title = 'Document';

  return page;
};

export const dependencies = (
  fetchResponse: FetchResponse = response()
): Stub => ({
  fetcher: { fetch: () => Effect.succeed(fetchResponse) },
  parser: {
    parse: (html, url) => Effect.succeed(parseDocument(html, url)),
  },
  extractor: { extract: () => Effect.succeed(article()) },
  sanitizer: { sanitize: (html) => Effect.succeed(html) },
});

// The collection ports are class-style service keys: the class instance type is
// what shows up in an effect's requirements channel.
const layer = (
  ports: Stub
): Layer.Layer<
  PageFetcher | HtmlDocumentParser | ArticleExtractor | HtmlSanitizer
> =>
  Layer.mergeAll(
    Layer.succeed(PageFetcher, ports.fetcher),
    Layer.succeed(HtmlDocumentParser, ports.parser),
    Layer.succeed(ArticleExtractor, ports.extractor),
    Layer.succeed(HtmlSanitizer, ports.sanitizer)
  );

export const run = <A, E>(
  effect: Effect.Effect<A, E, CollectServices>,
  ports: Stub
): Effect.Effect<A, E> => Effect.provide(effect, layer(ports));

export const collectWith = (page: Link, stubs: Stub): Effect.Effect<Post> =>
  run(collectPage(page), stubs);

export const unreachable = (): Effect.Effect<never, Error> =>
  Effect.fail(new Error('stage reached'));
