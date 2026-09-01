import type { PageReader } from '../port';

export const createPageReader = (page: Document = document): PageReader => ({
  readPage: () => ({
    url: page.URL,
    title: page.querySelector('title')?.textContent ?? page.title,
    links: [...page.querySelectorAll<HTMLAnchorElement>('a[href]')].map(
      (anchor, order) => ({
        href: anchor.getAttribute('href') ?? '',
        text: anchor.textContent,
        ariaLabel: anchor.getAttribute('aria-label'),
        imageAlt: anchor.querySelector('img')?.getAttribute('alt') ?? null,
        order,
      })
    ),
  }),
});
