import type { CandidateLink } from '../entity';

const blockedExtensions =
  /\.(?:pdf|png|jpe?g|gif|webp|avif|svg|ico|mp3|wav|ogg|mp4|webm|woff2?|ttf|otf|zip|tar|gz|rar|7z|exe|dmg|pkg|deb|rpm)$/i;

const trackingParameter = /^(?:utm_.+|ref|source|campaign|fbclid|gclid)$/i;

const text = (value?: string | null): string =>
  value?.replace(/\s+/g, ' ').trim() ?? '';

const normalize = (href: string, pageUrl: URL): URL | null => {
  if (href.trim().startsWith('#')) {
    return null;
  }

  try {
    const url = new URL(href, pageUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== pageUrl.origin
    ) {
      return null;
    }

    url.hash = '';
    for (const name of [...url.searchParams.keys()]) {
      if (trackingParameter.test(name)) {
        url.searchParams.delete(name);
      }
    }

    return blockedExtensions.test(url.pathname) ? null : url;
  } catch {
    return null;
  }
};

const keyFor = (url: URL): string => {
  const pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, '');

  return `${url.origin}${pathname}${url.search}`;
};

const labelFor = (link: HTMLAnchorElement, url: URL): string =>
  text(link.textContent) ||
  text(link.getAttribute('aria-label')) ||
  text(link.querySelector('img')?.getAttribute('alt')) ||
  decodeURIComponent(url.pathname) ||
  url.href;

export const discover = (page: Document): CandidateLink[] => {
  const pageUrl = new URL(page.URL);
  const seen = new Set<string>();
  const candidates: CandidateLink[] = [];

  for (const [order, link] of [
    ...page.querySelectorAll<HTMLAnchorElement>('a[href]'),
  ].entries()) {
    const url = normalize(link.getAttribute('href') ?? '', pageUrl);
    if (!url || seen.has(keyFor(url))) {
      continue;
    }

    seen.add(keyFor(url));
    candidates.push({
      url: url.href,
      label: labelFor(link, url),
      path: `${url.pathname}${url.search}`,
      order,
    });
  }

  return candidates;
};
