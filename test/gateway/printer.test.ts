import { describe, expect, it, vi } from 'vitest';
import { showPreview } from '../../src/gateway/printer';

describe('printer', () => {
  it('builds safe DOM with marker, failure log, no URLs, and prints on click', () => {
    const target = {
      document: document.implementation.createHTMLDocument(),
      print: vi.fn(),
      opener: window,
    } as unknown as Window;
    showPreview(target, {
      articles: [{ title: '<Unsafe>', content: '<p>Body</p>', url: 'https://secret.test' }],
      failures: [{ url: 'https://secret.test/fail', code: 'network-error', message: 'no' }],
    });
    expect(target.document.querySelector('[data-web-printer-preview]')).toBeTruthy();
    expect(target.document.body.textContent).toContain('<Unsafe>');
    expect(target.document.body.textContent).not.toContain('secret.test');
    expect(target.document.querySelector('aside')?.textContent).toContain('network-error: no');
    target.document.querySelector('button')?.click();
    expect(target.print).toHaveBeenCalled();
  });
});
