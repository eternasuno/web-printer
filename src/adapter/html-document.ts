import { Layer } from 'effect';
import { HtmlDocumentParser } from '../port';

export const HtmlDocumentParserLive = Layer.succeed(HtmlDocumentParser, {
  parse: (html, url) => {
    const page = new DOMParser().parseFromString(html, 'text/html');
    const base = page.createElement('base');
    base.href = url;
    page.head.prepend(base);

    return page;
  },
});
