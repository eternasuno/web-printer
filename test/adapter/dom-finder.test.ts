import { describe, expect, it } from 'vitest';
import { findLinks } from '../../src/adapter/dom-finder';

const documentFor = (html: string) => {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = html;
  Object.defineProperty(doc, 'evaluate', {
    value: (xpath: string) => {
      if (xpath.includes('string(')) return { snapshotLength: 1, snapshotItem: () => 'text' };
      if (xpath === '//*[') throw new Error('Invalid XPath');
      const nodes = xpath.includes('//*[@id="x"]')
        ? [doc.querySelector('a'), doc.querySelector('#x')]
        : [...doc.querySelectorAll('a')];
      return { snapshotLength: nodes.length, snapshotItem: (index: number) => nodes[index] };
    },
  });
  return doc;
};

describe('DOM finder', () => {
  it('finds anchors directly and inside containers in document order', () => {
    const doc = documentFor('<a href="/a">A</a><div id="x"><a href="/b">B</a></div>');
    expect(findLinks('//a | //*[@id="x"]', doc).map((link) => link.href)).toEqual(['/a', '/b']);
  });
  it('deduplicates nested anchor results', () => {
    const doc = documentFor('<div id="x"><a href="/a">A</a></div>');
    expect(findLinks('//*[@id="x"] | //a', doc)).toHaveLength(1);
  });
  it('preserves text and download state', () => {
    const doc = documentFor('<a href="/x" download> X </a>');
    expect(findLinks('//a', doc)).toEqual([{ text: ' X ', href: '/x', downloadable: true }]);
  });
  it('rejects invalid XPath and non-node results', () => {
    const doc = documentFor('<p>x</p>');
    expect(() => findLinks('//*[', doc)).toThrow();
    expect(() => findLinks('string(//p)', doc)).toThrow('elements');
  });
});
