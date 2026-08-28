import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';

const allowedTags = [
  'article',
  'section',
  'div',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'mark',
  'small',
  'sub',
  'sup',
  'pre',
  'code',
  'kbd',
  'samp',
  'blockquote',
  'q',
  'table',
  'caption',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'figure',
  'figcaption',
  'a',
  'img',
  'picture',
  'source',
];
const allowedAttrs = [
  'href',
  'src',
  'srcset',
  'alt',
  'width',
  'height',
  'loading',
  'target',
  'rel',
  'colspan',
  'rowspan',
  'scope',
];
const absolute = (value: string, base: string): string | undefined => {
  try {
    return new URL(value, base).href;
  } catch {
    return undefined;
  }
};
const normalizeSrcset = (value: string, base: string): string =>
  value
    .split(',')
    .flatMap((part) => {
      const match = part.trim().match(/^(\S+)(?:\s+(.+))?$/);
      if (!match) return [];
      const url = absolute(match[1], base);
      return url?.startsWith('https:') ? [`${url}${match[2] ? ` ${match[2]}` : ''}`] : [];
    })
    .join(', ');

const titleFromUrl = (finalUrl: string): string => {
  try {
    const path = new URL(finalUrl).pathname.split('/').filter(Boolean).pop();
    return path ? decodeURIComponent(path) : '';
  } catch {
    return '';
  }
};

export const extractArticle = (html: string, finalUrl: string, order = 1) => {
  const doc = new DOMParser().parseFromString(
    html.replace(/<iframe\b[\s\S]*?<\/iframe\s*>/gi, '').replace(/<iframe\b[^>]*\/?>/gi, ''),
    'text/html',
  );
  const base = doc.createElement('base');
  base.href = finalUrl;
  doc.head.prepend(base);
  let parsed: ReturnType<Readability['parse']>;
  try {
    parsed = new Readability(doc).parse();
  } catch (error) {
    throw Object.assign(new Error(error instanceof Error ? error.message : String(error)), {
      code: 'parse-failed',
    });
  }
  if (!parsed)
    throw Object.assign(new Error('No readable content found'), { code: 'no-readable-content' });
  const extracted = doc.createElement('div');
  extracted.innerHTML = parsed.content || '';
  for (const element of extracted.querySelectorAll(
    'script, iframe, style, svg, math, object, embed',
  ))
    element.remove();
  extracted.querySelectorAll('*').forEach((element) => {
    for (const attribute of element.getAttributeNames()) {
      if (attribute.startsWith('on') || attribute === 'style') element.removeAttribute(attribute);
    }
  });
  const clean = DOMPurify.sanitize(extracted.innerHTML, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttrs,
    ALLOW_DATA_ATTR: false,
    RETURN_TRUSTED_TYPE: false,
  });
  const wrapper = doc.createElement('div');
  wrapper.innerHTML = clean;
  for (const element of wrapper.querySelectorAll('[href], [src], [srcset]')) {
    for (const attr of ['href', 'src', 'srcset']) {
      const value = element.getAttribute(attr);
      if (!value) continue;
      const normalized =
        attr === 'srcset' ? normalizeSrcset(value, finalUrl) : absolute(value, finalUrl);
      if (
        !normalized ||
        ((attr === 'src' || attr === 'srcset') &&
          !normalized.split(/[, ]/)[0].startsWith('https:')) ||
        (attr === 'href' && !/^https?:/i.test(normalized))
      )
        element.removeAttribute(attr);
      else element.setAttribute(attr, normalized);
    }
  }
  wrapper.querySelectorAll('a[target="_blank"]').forEach((element) => {
    element.setAttribute('rel', 'noopener noreferrer');
  });
  const content = DOMPurify.sanitize(wrapper.innerHTML, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttrs,
    ALLOW_DATA_ATTR: false,
    RETURN_TRUSTED_TYPE: false,
  });
  if (!content.trim() || !wrapper.textContent?.trim())
    throw Object.assign(new Error('Empty sanitized content'), {
      code: 'sanitized-content-empty',
    });
  return {
    title: parsed.title?.trim() || doc.title.trim() || titleFromUrl(finalUrl) || `Page ${order}`,
    content,
  };
};
