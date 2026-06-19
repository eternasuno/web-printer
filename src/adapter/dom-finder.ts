import type { Dom, LinkInfo } from '../core/port';

const resolveUrl = (href: string): string | null => {
  try {
    return new URL(href, window.location.href).href;
  } catch {
    return null;
  }
};

export const createDomFinder = (): Dom => ({
  findLinks: (selector: string): LinkInfo[] => {
    const anchors = document.querySelectorAll<HTMLAnchorElement>(selector);
    const links: LinkInfo[] = [];
    for (const a of anchors) {
      const href = a.getAttribute('href');
      if (!href) continue;
      const url = resolveUrl(href);
      if (!url) continue;
      links.push({ text: a.textContent?.trim() || url, url });
    }
    return links;
  },
});
