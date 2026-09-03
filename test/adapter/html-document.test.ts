import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { HtmlTransformerLive } from '../../src/adapter/html-document';
import { HtmlTransformer } from '../../src/port';

const transformer = Effect.runSync(
  Effect.provide(HtmlTransformer, HtmlTransformerLive)
);

const transform = (html: string, title = 'Guide') =>
  transformer.transform(html, 'https://docs.example.test/guide/page', title);

const body = (html: string) => {
  const page = document.implementation.createHTMLDocument();
  page.body.innerHTML = html;

  return page.body;
};

describe('HTML document adapter', () => {
  it('absolutizes links and standard image sources', () => {
    const output = body(
      transform(`
        <a href="../other#part">Other</a>
        <img src="./image.png" srcset="small.png 1x, /large.png 2x">
        <picture><source srcset="wide.webp 800w"></picture>
      `)
    );

    expect(output.querySelector('a')?.href).toBe(
      'https://docs.example.test/other#part'
    );
    expect(output.querySelector('img')?.src).toBe(
      'https://docs.example.test/guide/image.png'
    );
    expect(output.querySelector('img')?.getAttribute('srcset')).toBe(
      'https://docs.example.test/guide/small.png 1x, https://docs.example.test/large.png 2x'
    );
    expect(output.querySelector('source')?.getAttribute('srcset')).toBe(
      'https://docs.example.test/guide/wide.webp 800w'
    );
  });

  it('promotes lazy image attributes only when standard attributes are absent', () => {
    const output = body(
      transform(`
        <img data-src="lazy.png" data-srcset="lazy-small.png 1x, lazy-large.png 2x">
        <img src="real.png" data-src="ignored.png" srcset="real-2x.png 2x" data-srcset="ignored-2x.png 2x">
      `)
    );
    const images = output.querySelectorAll('img');

    expect(images[0]?.getAttribute('src')).toBe(
      'https://docs.example.test/guide/lazy.png'
    );
    expect(images[0]?.getAttribute('srcset')).toContain('lazy-small.png');
    expect(images[1]?.getAttribute('src')).toBe(
      'https://docs.example.test/guide/real.png'
    );
    expect(images[1]?.getAttribute('srcset')).toContain('real-2x.png');
  });

  it('removes only a matching first h1', () => {
    const matching = body(
      transform('<h1>  GUIDE </h1><p>Body</p><h1>Guide</h1>')
    );
    const different = body(transform('<h1>Introduction</h1><p>Body</p>'));

    expect(matching.querySelectorAll('h1')).toHaveLength(1);
    expect(matching.firstElementChild?.tagName).toBe('P');
    expect(different.querySelector('h1')?.textContent).toBe('Introduction');
  });
});
