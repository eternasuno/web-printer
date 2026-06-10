import { describe, expect, it, vi } from 'vitest';
import type { Article } from '../../src/core/entity';
import { buildHtml, printHtml } from '../../src/gateway/printer';

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
});

// ---------------------------------------------------------------------------
// printHtml
// ---------------------------------------------------------------------------

describe('printHtml', () => {
  it('returns without error when popup is blocked', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    await expect(printHtml('<html></html>')).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });

  it('writes HTML to new window and calls print', async () => {
    vi.useFakeTimers();
    const mockDoc = { close: vi.fn(), write: vi.fn() };
    const mockWin = {
      closed: false,
      document: mockDoc,
      focus: vi.fn(),
      print: vi.fn(),
    } as unknown as Window & { closed: boolean };

    vi.spyOn(window, 'open').mockReturnValue(mockWin);

    const promise = printHtml('<html>test</html>');

    await vi.advanceTimersByTimeAsync(500);
    expect(mockDoc.write).toHaveBeenCalledWith('<html>test</html>');
    expect(mockWin.print).toHaveBeenCalled();

    mockWin.closed = true;
    await vi.advanceTimersByTimeAsync(600);

    await promise;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});