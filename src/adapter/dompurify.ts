import DOMPurify from 'dompurify';
import type { HtmlSanitizer } from '../port';

export const createHtmlSanitizer = (): HtmlSanitizer => ({
  sanitize: (html) =>
    DOMPurify.sanitize(html, {
      FORBID_TAGS: ['iframe', 'object', 'embed', 'script', 'style'],
      FORBID_ATTR: ['style'],
      RETURN_TRUSTED_TYPE: false,
    }),
});
