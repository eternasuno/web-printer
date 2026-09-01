import { describe, expect, it } from 'vitest';
import { createPageReader } from '../../src/adapter/page-dom';

const createPage = (html: string) => {
  const page = document.implementation.createHTMLDocument();
  page.title = 'Guide';
  page.body.innerHTML = html;
  Object.defineProperty(page, 'URL', {
    value: 'https://docs.example.test/guide/start',
  });

  return page;
};

describe('page DOM adapter', () => {
  it('maps current page data and links in DOM order', () => {
    const page = createPage(`
      <a href="/one" aria-label="First aria"> First text </a>
      <a href="/two"><img alt="Second image"></a>
    `);

    expect(createPageReader(page).readPage()).toEqual({
      url: 'https://docs.example.test/guide/start',
      title: 'Guide',
      links: [
        {
          href: '/one',
          text: ' First text ',
          ariaLabel: 'First aria',
          imageAlt: null,
          order: 0,
        },
        {
          href: '/two',
          text: '',
          ariaLabel: null,
          imageAlt: 'Second image',
          order: 1,
        },
      ],
    });
  });

  it('does not filter or normalize raw links', () => {
    const page = createPage(`
      <a href="#part">Fragment</a>
      <a href="https://external.test/page">External</a>
      <a href="/page?utm_source=x">Tracked</a>
    `);

    expect(
      createPageReader(page)
        .readPage()
        .links.map((link) => link.href)
    ).toEqual(['#part', 'https://external.test/page', '/page?utm_source=x']);
  });
});
