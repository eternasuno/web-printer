import { expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import { HtmlSanitizerLive } from '../../src/adapter/dompurify';
import { HtmlSanitizer } from '../../src/port';

const sanitize = (html: string) =>
  Effect.gen(function* () {
    const sanitizer = yield* HtmlSanitizer;

    return yield* sanitizer.sanitize(html);
  });

const body = (html: string) => {
  const page = document.implementation.createHTMLDocument();
  page.body.innerHTML = html;

  return page.body;
};

it.layer(HtmlSanitizerLive)('DOMPurify adapter', (it) => {
  it.effect('removes executable and embedded content', () =>
    Effect.gen(function* () {
      const output = body(
        yield* sanitize(`
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
    })
  );

  it.effect('removes inline styles and dangerous URL protocols', () =>
    Effect.gen(function* () {
      const output = body(
        yield* sanitize(`
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
    })
  );

  it.effect('preserves documentation structure', () =>
    Effect.gen(function* () {
      const output = body(
        yield* sanitize(`
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
    })
  );
});
