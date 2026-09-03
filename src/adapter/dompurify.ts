import DOMPurify from 'dompurify';
import { Layer } from 'effect';
import { HtmlSanitizer } from '../port';

export const HtmlSanitizerLive = Layer.succeed(HtmlSanitizer, {
  sanitize: (html) =>
    DOMPurify.sanitize(html, {
      FORBID_TAGS: ['iframe', 'object', 'embed', 'script', 'style'],
      FORBID_ATTR: ['style'],
      RETURN_TRUSTED_TYPE: false,
    }),
});
