import DOMPurify from 'dompurify';
import type { HtmlSanitizer } from '../port';

const forbiddenTags = ['iframe', 'object', 'embed', 'script', 'style'];

const removeForbiddenContent = (html: string): string => {
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const element of template.content.querySelectorAll(
    forbiddenTags.join(',')
  )) {
    element.remove();
  }
  for (const element of template.content.querySelectorAll('*')) {
    element.removeAttribute('style');
    for (const attribute of element.getAttributeNames()) {
      const value = element.getAttribute(attribute)?.trim() ?? '';
      if (attribute.startsWith('on') || /^javascript:/i.test(value)) {
        element.removeAttribute(attribute);
      }
    }
  }

  return template.innerHTML;
};

export const createHtmlSanitizer = (): HtmlSanitizer => ({
  sanitize: (html) =>
    removeForbiddenContent(
      DOMPurify.sanitize(html, {
        FORBID_TAGS: forbiddenTags,
        FORBID_ATTR: ['style'],
        RETURN_TRUSTED_TYPE: false,
      })
    ),
});
