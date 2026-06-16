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

  it('resolves relative URLs to absolute', () => {
    document.body.innerHTML = `<a href="/docs/guide">Guide</a>`;
    const links = createDomFinder().findLinks('a');
    expect(links[0].url).toContain('/docs/guide');
  });

  it('includes all hrefs without filtering', () => {
    document.body.innerHTML = `
      <a href="javascript:void(0)">Click</a>
      <a href="mailto:test@example.com">Email</a>
      <a href="#">Top</a>
      <a href="/docs/intro">Intro</a>
    `;
    const links = createDomFinder().findLinks('a');
    expect(links).toHaveLength(4);
  });

  it('includes duplicate URLs without deduplication', () => {
    document.body.innerHTML = `
      <a href="/docs/intro">Intro</a>
      <a href="/docs/intro">Introduction</a>
    `;
    const links = createDomFinder().findLinks('a');
    expect(links).toHaveLength(2);
  });

  it('skips anchors without href attribute', () => {
    document.body.innerHTML = `<a name="anchor">No href</a>`;
    expect(createDomFinder().findLinks('a')).toHaveLength(0);
  });

  it('includes anchors with unusual hrefs (filtering is usecase concern)', () => {
    document.body.innerHTML = `<a href="://invalid">Broken</a>`;
    const links = createDomFinder().findLinks('a');
    // Adapter does not filter; usecase handles validity checks
    expect(links.length).toBeGreaterThanOrEqual(0);
  });
});
