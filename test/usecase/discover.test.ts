import { describe, expect, it } from 'vitest';
import { discover } from '../../src/usecase/discover';

const page = (
  links: Array<{
    href: string;
    text?: string;
    ariaLabel?: string;
    imageAlt?: string;
  }>
): Document => {
  const result = document.implementation.createHTMLDocument('Guide');
  Object.defineProperty(result, 'URL', {
    value: 'https://docs.example.test/guide/start',
  });

  for (const link of links) {
    const anchor = result.createElement('a');
    anchor.href = link.href;
    anchor.setAttribute('href', link.href);
    anchor.textContent = link.text ?? '';
    if (link.ariaLabel) {
      anchor.setAttribute('aria-label', link.ariaLabel);
    }

    if (link.imageAlt) {
      const image = result.createElement('img');
      image.alt = link.imageAlt;
      anchor.append(image);
    }
    result.body.append(anchor);
  }

  return result;
};

describe('discover', () => {
  it('should keep same-origin HTTP links in DOM order', () => {
    const result = discover(
      page([
        { href: '/first', text: 'First' },
        { href: 'https://docs.example.test/second', text: 'Second' },
        { href: 'https://other.test/page', text: 'External' },
        { href: 'mailto:team@example.test', text: 'Mail' },
      ])
    );

    expect(result.map(({ id, url, label }) => ({ id, url, label }))).toEqual([
      { id: 0, url: 'https://docs.example.test/first', label: 'First' },
      { id: 1, url: 'https://docs.example.test/second', label: 'Second' },
    ]);
  });

  it('should assign contiguous ids after filtering and deduplication', () => {
    const result = discover(
      page([
        { href: '/manual.pdf', text: 'Resource' },
        { href: 'mailto:team@example.test', text: 'Mail' },
        { href: 'https://other.test/page', text: 'External' },
        { href: '#intro', text: 'Fragment' },
        { href: '/first', text: 'First' },
        { href: '/first/', text: 'Trailing slash' },
        { href: '/first?utm_source=x', text: 'Tracking' },
        { href: '/second', text: 'Second' },
        { href: '/third', text: 'Third' },
      ])
    );

    expect(result.map((item) => item.id)).toEqual([0, 1, 2]);
    expect(result.map((item) => item.url)).toEqual([
      'https://docs.example.test/first',
      'https://docs.example.test/second',
      'https://docs.example.test/third',
    ]);
  });

  it('should exclude pure fragments but keep explicit current-page links', () => {
    const result = discover(
      page([
        { href: '#intro', text: 'Intro' },
        { href: '/guide/start#intro', text: 'Start' },
      ])
    );

    expect(result).toHaveLength(1);
    expect(result.at(0)?.url).toBe('https://docs.example.test/guide/start');
  });

  it('should remove tracking parameters and preserve other query parameters', () => {
    const [result] = discover(
      page([
        {
          href: '/search?q=effect&utm_source=news&REF=home&source=nav&campaign=x&fbclid=f&gclid=g',
          text: 'Search',
        },
      ])
    );

    expect(result?.url).toBe('https://docs.example.test/search?q=effect');
  });

  it('should deduplicate fragments, tracking variants, and trailing slashes', () => {
    const result = discover(
      page([
        { href: '/guide/page/', text: 'First' },
        { href: '/guide/page#part', text: 'Fragment' },
        { href: '/guide/page?utm_medium=email', text: 'Tracking' },
      ])
    );

    expect(result).toHaveLength(1);
    expect(result.at(0)?.id).toBe(0);
    expect(result.at(0)?.url).toBe('https://docs.example.test/guide/page/');
    expect(result.at(0)?.label).toBe('First');
  });

  it('should not merge distinct meaningful queries or the site root', () => {
    const result = discover(
      page([
        { href: '/?view=a', text: 'A' },
        { href: '/?view=b', text: 'B' },
        { href: '/guide?view=a', text: 'Guide A' },
        { href: '/guide?view=b', text: 'Guide B' },
      ])
    );

    expect(result.map((item) => item.url)).toEqual([
      'https://docs.example.test/?view=a',
      'https://docs.example.test/?view=b',
      'https://docs.example.test/guide?view=a',
      'https://docs.example.test/guide?view=b',
    ]);
  });

  it.each([
    '/manual.PDF',
    '/image.webp',
    '/movie.mp4',
    '/font.woff2',
    '/archive.tar',
    '/installer.dmg',
  ])('should exclude obvious resource URL %s', (href) => {
    expect(discover(page([{ href, text: 'Resource' }]))).toEqual([]);
  });

  it('should use the specified label fallback order and collapse whitespace', () => {
    const result = discover(
      page([
        { href: '/text', text: '  Visible\n text  ', ariaLabel: 'Aria' },
        { href: '/aria', text: ' ', ariaLabel: ' Aria label ' },
        { href: '/image', imageAlt: ' Image alt ' },
        { href: '/path' },
      ])
    );

    expect(result.map((item) => item.label)).toEqual([
      'Visible text',
      'Aria label',
      'Image alt',
      '/path',
    ]);
  });
});
