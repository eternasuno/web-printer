import type { LinkInfo } from '../core/port';
import type { DomPort } from '../core/port';

const isIgnoredHref = (href: string): boolean =>
  !href ||
  href.startsWith('javascript:') ||
  href.startsWith('mailto:') ||
  href === '#' ||
  href.startsWith('://');

const isHttpUrl = (url: string): boolean =>
  url.startsWith('http://') || url.startsWith('https://');

const resolveUrl = (href: string): string | null => {
  try {
    return new URL(href, window.location.href).href;
  } catch {
    return null;
  }
};

export const createDomFinder = (): DomPort => ({
  findLinks: (selector: string): LinkInfo[] => {
    const anchors = document.querySelectorAll<HTMLAnchorElement>(selector);
    const seen = new Set<string>();
    const links: LinkInfo[] = [];
    for (const a of anchors) {
      const href = a.getAttribute('href');
      if (!href || isIgnoredHref(href)) continue;
      const url = resolveUrl(href);
      if (!url || seen.has(url) || !isHttpUrl(url)) continue;
      seen.add(url);
      links.push({ text: a.textContent?.trim() || url, url });
    }
    return links;
  },
});