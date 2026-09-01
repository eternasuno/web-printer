import { describe, expect, it } from 'vitest';
import { discover } from '../../src/usecase/discover';

const page = (
  links: Array<{
    href: string;
    text?: string;
    ariaLabel?: string;
    imageAlt?: string;
  }>
) => ({
  url: 'https://docs.example.test/guide/start',
  title: 'Guide',
  links: links.map((link, order) => ({ ...link, order })),
});

describe('discover', () => {
  it('keeps same-origin HTTP links in DOM order', () => {
    const result = discover(
      page([
        { href: '/first', text: 'First' },
        { href: 'https://docs.example.test/second', text: 'Second' },
        { href: 'https://other.test/page', text: 'External' },
        { href: 'mailto:team@example.test', text: 'Mail' },
      ])
    );

    expect(result.map(({ url, label }) => ({ url, label }))).toEqual([
      { url: 'https://docs.example.test/first', label: 'First' },
      { url: 'https://docs.example.test/second', label: 'Second' },
    ]);
  });

  it('excludes pure fragments but keeps explicit current-page links', () => {
    const result = discover(
      page([
        { href: '#intro', text: 'Intro' },
        { href: '/guide/start#intro', text: 'Start' },
      ])
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.url).toBe('https://docs.example.test/guide/start');
  });

  it('removes tracking parameters and preserves other query parameters', () => {
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

  it('deduplicates fragments, tracking variants, and trailing slashes', () => {
    const result = discover(
      page([
        { href: '/guide/page/', text: 'First' },
        { href: '/guide/page#part', text: 'Fragment' },
        { href: '/guide/page?utm_medium=email', text: 'Tracking' },
      ])
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.url).toBe('https://docs.example.test/guide/page/');
    expect(result[0]?.label).toBe('First');
  });

  it('does not merge distinct meaningful queries or the site root', () => {
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
  ])('excludes obvious resource URL %s', (href) => {
    expect(discover(page([{ href, text: 'Resource' }]))).toEqual([]);
  });

  it('uses the specified label fallback order and collapses whitespace', () => {
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
