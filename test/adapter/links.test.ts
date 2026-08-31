import { describe, expect, it } from 'vitest';
import { discoverLinks } from '../../src/adapter/links';

const documentFor = (html: string) => {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = html;
  Object.defineProperty(doc, 'evaluate', {
    value: (xpath: string) => {
      if (xpath.includes('string('))
        return { snapshotLength: 1, snapshotItem: () => 'text' };
      if (xpath === '//*[') throw new Error('Invalid XPath');
      const nodes = xpath.includes('//*[@id="x"]')
        ? [doc.querySelector('a'), doc.querySelector('#x')]
        : [...doc.querySelectorAll('a')];
      return {
        snapshotLength: nodes.length,
        snapshotItem: (index: number) => nodes[index],
      };
    },
  });
  return doc;
};

describe('links', () => {
  it('finds anchors directly and inside containers in document order', () => {
    const doc = documentFor(
      '<a href="/a">A</a><div id="x"><a href="/b">B</a></div>'
    );
    expect(
      discoverLinks('//a | //*[@id="x"]', 'https://site.test/start', doc).map(
        (link) => link.url
      )
    ).toEqual(['https://site.test/a', 'https://site.test/b']);
  });

  it('deduplicates nested anchor results and preserves raw link state', () => {
    const doc = documentFor('<div id="x"><a href="/a"> X </a></div>');
    expect(
      discoverLinks('//*[@id="x"] | //a', 'https://site.test/start', doc)
    ).toEqual([{ text: 'X', url: 'https://site.test/a' }]);
    const downloadable = documentFor('<a href="/file" download>File</a>');
    expect(
      discoverLinks('//a', 'https://site.test/start', downloadable)
    ).toEqual([]);
  });

  it.each([
    ['protocol', 'http://site.test/x', 'http://site.test/p'],
    ['subdomain', 'https://docs.site.test/x', 'https://docs.site.test/p'],
    ['port', 'https://site.test:8443/x', 'https://site.test:8443/p'],
    ['relative', 'https://site.test/guide/page', '../next'],
  ])('accepts same-origin %s and resolves URLs', (_, page, href) => {
    const links = discoverLinks(
      '//a',
      page,
      documentFor(`<a href="${href}">Next</a>`)
    );
    expect(links[0]?.url).toBe(new URL(href, page).href);
  });

  it('rejects origin changes and credentials', () => {
    const doc = documentFor(
      '<a href="http://docs.site.test/a">Protocol</a><a href="https://site.test/a">Subdomain</a><a href="https://docs.site.test:444/a">Port</a><a href="https://u:p@docs.site.test/private">Credentials</a>'
    );
    expect(discoverLinks('//a', 'https://docs.site.test:443/a', doc)).toEqual(
      []
    );
  });

  it('removes fragments, deduplicates, rejects unsafe links, and limits results', () => {
    const fragmentLinks = discoverLinks(
      '//a',
      'https://site.test/a',
      documentFor(
        '<a href="/a#part">Part</a><a href="/a#other">Other</a><a href="javascript:bad">Bad</a>'
      )
    );
    expect(fragmentLinks).toEqual([
      { text: 'Part', url: 'https://site.test/a' },
    ]);

    const links = discoverLinks(
      'x',
      'https://site.test/a',
      documentFor(
        Array.from(
          { length: 205 },
          (_, i) => `<a href="/p${i % 201}">P</a>`
        ).join('')
      )
    );
    expect(links).toHaveLength(200);
    expect(new Set(links.map((link) => link.url)).size).toBe(200);
    expect(links.truncated).toBe(true);
  });

  it('rejects empty XPath and falls back to URL text', () => {
    expect(() => discoverLinks('  ', location.href)).toThrow(
      'XPath is required'
    );
    expect(
      discoverLinks(
        'x',
        'https://site.test/a',
        documentFor('<a href="/x">  </a>')
      )[0]?.text
    ).toBe('https://site.test/x');
  });
});
