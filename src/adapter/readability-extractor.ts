import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';
import type { Article } from '../core/entity';

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
const purifyConfig = {
  ALLOWED_TAGS: allowedTags,
  ALLOWED_ATTR: allowedAttrs,
  ALLOW_DATA_ATTR: false,
  RETURN_TRUSTED_TYPE: false,
};

const sanitize = (html: string): string =>
  DOMPurify.sanitize(html, purifyConfig);

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
      const candidate = match?.[1];
      const descriptor = match?.[2];
      const url = candidate ? absolute(candidate, base) : undefined;
      return url?.startsWith('https:')
        ? [`${url}${descriptor ? ` ${descriptor}` : ''}`]
        : [];
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

const stripIframes = (html: string): string =>
  html
    .replace(/<iframe\b[\s\S]*?<\/iframe\s*>/gi, '')
    .replace(/<iframe\b[^>]*\/?>/gi, '');

type Parsed = NonNullable<ReturnType<Readability['parse']>>;

const parseReadable = (doc: Document): Parsed => {
  let parsed: ReturnType<Readability['parse']>;
  try {
    parsed = new Readability(doc).parse();
  } catch (error) {
    throw Object.assign(
      new Error(error instanceof Error ? error.message : String(error)),
      {
        code: 'parse-failed',
      }
    );
  }
  if (!parsed)
    throw Object.assign(new Error('No readable content found'), {
      code: 'no-readable-content',
    });
  return parsed;
};

const stripDangerous = (root: HTMLElement): void => {
  for (const element of root.querySelectorAll(
    'script, iframe, style, svg, math, object, embed'
  ))
    element.remove();
  for (const element of root.querySelectorAll('*')) {
    for (const attribute of element.getAttributeNames()) {
      if (attribute.startsWith('on')) element.removeAttribute(attribute);
    }
  }
};

const urlValueSafe = (attr: string, value: string): boolean => {
  if (attr === 'href') return /^https?:/i.test(value);
  return value.split(/[, ]/)[0]?.startsWith('https:') ?? false;
};

const normalizeAttr = (element: Element, attr: string, base: string): void => {
  const value = element.getAttribute(attr);
  if (!value) return;
  const normalized =
    attr === 'srcset' ? normalizeSrcset(value, base) : absolute(value, base);
  if (!normalized || !urlValueSafe(attr, normalized))
    element.removeAttribute(attr);
  else element.setAttribute(attr, normalized);
};

const normalizeUrls = (root: HTMLElement, base: string): void => {
  for (const element of root.querySelectorAll('[href], [src], [srcset]')) {
    for (const attr of ['href', 'src', 'srcset'])
      normalizeAttr(element, attr, base);
  }
};

const secureBlankTargets = (root: HTMLElement): void => {
  for (const element of root.querySelectorAll('a[target="_blank"]')) {
    element.setAttribute('rel', 'noopener noreferrer');
  }
};

const resolveTitle = (
  parsed: Parsed,
  doc: Document,
  finalUrl: string,
  order: number
): string =>
  parsed.title?.trim() ||
  doc.title.trim() ||
  titleFromUrl(finalUrl) ||
  `Page ${order}`;

export const extractArticle = (
  html: string,
  finalUrl: string,
  order = 1
): Article => {
  const doc = new DOMParser().parseFromString(stripIframes(html), 'text/html');
  const base = doc.createElement('base');
  base.href = finalUrl;
  doc.head.prepend(base);
  const parsed = parseReadable(doc);
  const extracted = doc.createElement('div');
  extracted.innerHTML = parsed.content || '';
  stripDangerous(extracted);
  const wrapper = doc.createElement('div');
  wrapper.innerHTML = sanitize(extracted.innerHTML);
  normalizeUrls(wrapper, finalUrl);
  secureBlankTargets(wrapper);
  const content = sanitize(wrapper.innerHTML);
  if (!content.trim() || !wrapper.textContent?.trim())
    throw Object.assign(new Error('Empty sanitized content'), {
      code: 'sanitized-content-empty',
    });
  return { title: resolveTitle(parsed, doc, finalUrl, order), content };
};
