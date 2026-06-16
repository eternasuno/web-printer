import { describe, expect, it, vi } from 'vitest';
import type { Article } from '../../src/core/entity';
import { buildHtml, openPreview } from '../../src/gateway/printer';

// ---------------------------------------------------------------------------
// buildHtml
// ---------------------------------------------------------------------------

describe('buildHtml', () => {
  it('generates HTML with correct page sections', () => {
    const articles: Article[] = [
      { content: '<p>A</p>', title: 'Page A', url: 'https://example.com/a' },
      { content: '<p>B</p>', title: 'Page B', url: 'https://example.com/b' },
    ];
    const html = buildHtml(articles);
    expect(html).toContain('Page A');
    expect(html).toContain('Page B');
    expect(html).toContain('page-section');
  });

  it('includes print styles', () => {
    const html = buildHtml([{ content: '<p>A</p>', title: 'A', url: 'https://example.com/a' }]);
    expect(html).toContain('@media print');
    expect(html).toContain('page-break-before');
  });

  it('includes source URL', () => {
    const html = buildHtml([{ content: '<p>A</p>', title: 'A', url: 'https://example.com/a' }]);
    expect(html).toContain('Source');
    expect(html).toContain('https://example.com/a');
  });

  it('escapes special characters in title', () => {
    const html = buildHtml([
      {
        content: '<p>A</p>',
        title: 'A & B < C > "D"',
        url: 'https://example.com/a',
      },
    ]);
    expect(html).toContain('A &amp; B &lt; C &gt; &quot;D&quot;');
  });

  it('handles empty article array', () => {
    const html = buildHtml([]);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<main id="content"></main>');
  });

  it('uses URL as fallback when title is empty', () => {
    const html = buildHtml([
      { content: '<p>No title</p>', title: '', url: 'https://example.com/no-title' },
    ]);
    expect(html).toContain('https://example.com/no-title');
  });

  it('includes preview toolbar and settings modal', () => {
    const html = buildHtml([{ content: '<p>A</p>', title: 'A', url: 'https://example.com/a' }]);
    expect(html).toContain('wp-toolbar');
    expect(html).toContain('wp-print');
    expect(html).toContain('wp-settings');
    expect(html).toContain('wp-overlay');
    expect(html).toContain('wp-css-editor');
    expect(html).toContain('wp-apply');
  });

  it('includes style tag with id for preview updates', () => {
    const html = buildHtml([{ content: '<p>A</p>', title: 'A', url: 'https://example.com/a' }]);
    expect(html).toContain('id="wp-preview-style"');
  });

  it('escapes CSS content in textarea', () => {
    const html = buildHtml(
      [{ content: '<p>A</p>', title: 'A', url: 'https://example.com/a' }],
      '.test > .item & .other "thing" { color: red; }'
    );
    expect(html).toContain('id="wp-css-editor"');
    expect(html).toContain('.test &gt; .item &amp; .other &quot;thing&quot; { color: red; }');
  });
});

// ---------------------------------------------------------------------------
// openPreview
// ---------------------------------------------------------------------------

describe('openPreview', () => {
  it('returns null when popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const result = openPreview('<html></html>');
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it('opens window, writes HTML, and attaches event listeners', () => {
    const mockDoc = {
      close: vi.fn(),
      write: vi.fn(),
      getElementById: vi.fn().mockReturnValue(null),
      addEventListener: vi.fn(),
    };
    const mockWin = { closed: false, document: mockDoc, print: vi.fn() } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(mockWin);

    const result = openPreview('<html>test</html>');
    expect(result).toBe(mockWin);
    expect(mockDoc.write).toHaveBeenCalledWith('<html>test</html>');
    expect(mockDoc.close).toHaveBeenCalled();
    expect(mockDoc.getElementById).toHaveBeenCalled();
    expect(mockDoc.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));

    vi.restoreAllMocks();
  });
});
