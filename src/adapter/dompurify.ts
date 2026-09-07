import DOMPurify from 'dompurify';
import { Effect, Layer } from 'effect';
import { HtmlSanitizer } from '../port';

export const HtmlSanitizerLive = Layer.succeed(HtmlSanitizer, {
  sanitize: (html) =>
    Effect.try({
      try: () =>
        DOMPurify.sanitize(html, {
          FORBID_TAGS: ['iframe', 'object', 'embed', 'script', 'style'],
          FORBID_ATTR: ['style'],
          RETURN_TRUSTED_TYPE: false,
        }),
      catch: (error) =>
        error instanceof Error ? error : new Error(String(error)),
    }),
});
