import { beforeEach, describe, expect, it } from 'vitest';
import { createDomFinder } from '../../src/adapter/dom-finder';

describe('findLinks', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds links by CSS selector', () => {
    document.body.innerHTML = `
      <nav>
        <a href="/docs/intro">Introduction</a>
        <a href="/docs/guide">User Guide</a>
        <a href="/docs/api">API Reference</a>
      </nav>
    `;
    const links = createDomFinder().findLinks('nav a');
    expect(links).toHaveLength(3);
    expect(links.every((l) => 'text' in l && 'url' in l)).toBe(true);
  });

  it('uses anchor text as display label', () => {
    document.body.innerHTML = `<a href="/docs/getting-started">Getting Started</a>`;
    const links = createDomFinder().findLinks('a');
    expect(links[0].text).toBe('Getting Started');
  });

  it('falls back to URL when text is empty', () => {
    document.body.innerHTML = `<a href="/docs/quickref"></a>`;
    const links = createDomFinder().findLinks('a');
    expect(links[0].text).toBe(links[0].url);
  });

  it('ignores javascript: href', () => {
    document.body.innerHTML = `<a href="javascript:void(0)">Click</a>`;
    expect(createDomFinder().findLinks('a')).toHaveLength(0);
  });

  it('ignores mailto: href', () => {
    document.body.innerHTML = `<a href="mailto:test@example.com">Email</a>`;
    expect(createDomFinder().findLinks('a')).toHaveLength(0);
  });

  it('ignores empty fragment href', () => {
    document.body.innerHTML = `<a href="#">Top</a>`;
    expect(createDomFinder().findLinks('a')).toHaveLength(0);
  });

  it('deduplicates identical URLs', () => {
    document.body.innerHTML = `
      <a href="/docs/intro">Intro</a>
      <a href="/docs/intro">Introduction</a>
    `;
    expect(createDomFinder().findLinks('a')).toHaveLength(1);
  });

  it('resolves relative URLs to absolute', () => {
    document.body.innerHTML = `<a href="/docs/guide">Guide</a>`;
    const links = createDomFinder().findLinks('a');
    expect(links[0].url).toContain('/docs/guide');
  });

  it('skips invalid URLs', () => {
    document.body.innerHTML = `<a href="://invalid">Broken</a>`;
    expect(createDomFinder().findLinks('a')).toHaveLength(0);
  });
});
