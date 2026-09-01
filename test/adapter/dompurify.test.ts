import { describe, expect, it } from 'vitest';
import { createHtmlSanitizer } from '../../src/adapter/dompurify';

const sanitize = (html: string) => createHtmlSanitizer().sanitize(html);

const body = (html: string) => {
  const page = document.implementation.createHTMLDocument();
  page.body.innerHTML = html;

  return page.body;
};

describe('DOMPurify adapter', () => {
  it('removes executable and embedded content', () => {
    const output = body(
      sanitize(`
        <script>alert(1)</script>
        <iframe src="https://evil.test"></iframe>
        <object data="x"></object>
        <embed src="x">
        <style>body { display: none }</style>
        <p onclick="alert(1)">Safe text</p>
      `)
    );

    expect(
      output.querySelector('script, iframe, object, embed, style')
    ).toBeNull();
    expect(output.querySelector('p')?.hasAttribute('onclick')).toBe(false);
    expect(output.textContent).toContain('Safe text');
  });

  it('removes inline styles and dangerous URL protocols', () => {
    const output = body(
      sanitize(`
        <a href="javascript:alert(1)" style="display:none">Link</a>
        <img src="javascript:alert(1)" style="width:100px" alt="Image">
      `)
    );
    const link = output.querySelector('a');
    const image = output.querySelector('img');

    expect(link?.hasAttribute('href')).toBe(false);
    expect(link?.hasAttribute('style')).toBe(false);
    expect(image?.hasAttribute('src')).toBe(false);
    expect(image?.hasAttribute('style')).toBe(false);
  });

  it('preserves documentation structure', () => {
    const output = body(
      sanitize(`
        <h2>Heading</h2>
        <pre><code>const x = 1;</code></pre>
        <table><tbody><tr><td>Cell</td></tr></tbody></table>
        <picture><source srcset="image.webp"><img src="image.png" alt="Image"></picture>
      `)
    );

    expect(output.querySelector('h2')).not.toBeNull();
    expect(output.querySelector('pre code')).not.toBeNull();
    expect(output.querySelector('table td')?.textContent).toBe('Cell');
    expect(output.querySelector('picture source')).not.toBeNull();
    expect(output.querySelector('img')?.alt).toBe('Image');
  });
});
