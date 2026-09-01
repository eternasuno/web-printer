import { describe, expect, it, vi } from 'vitest';
import { openPreview } from '../../src/adapter/preview-window';

const createPopup = () => {
  const popupDocument = document.implementation.createHTMLDocument();
  const popup = {
    document: popupDocument,
    closed: false,
    close: vi.fn(),
    focus: vi.fn(),
    print: vi.fn(),
    postMessage: vi.fn(),
    opener: { postMessage: vi.fn() },
  };

  return { popup, popupDocument };
};

const styleOf = (page: Document, marker: string): string =>
  [...page.querySelectorAll('style')]
    .map((element) => element.textContent ?? '')
    .filter((text) => text.includes(marker))
    .join('');

const block = (source: string, query: string): string => {
  const start = source.indexOf(query);
  if (start < 0) {
    return '';
  }
  const end = source.indexOf('}}', start);

  return source.slice(start, end < 0 ? undefined : end + 2);
};

describe('preview window adapter', () => {
  it('returns null when the browser blocks the popup', () => {
    expect(openPreview(() => null, 'task-id', 'Guide')).toBeNull();
  });

  it('shows progress and supports Print and Close after rendering', () => {
    const { popup, popupDocument } = createPopup();
    const preview = openPreview(() => popup, 'task-id', 'Guide');

    preview?.update({
      completed: 2,
      total: 4,
      state: 'fetching',
    });
    expect(popupDocument.body.textContent).toContain('2 / 4');

    preview?.render({
      title: 'Guide',
      summary: {
        succeeded: 1,
        failed: 0,
        cancelled: 0,
        failures: [],
      },
      items: [
        {
          type: 'article',
          title: 'Page',
          contentHtml: '<p>Body</p>',
          sourceUrl: 'https://docs.test/page',
          breakBefore: false,
        },
      ],
    });
    popupDocument
      .querySelector<HTMLButtonElement>('[data-action="print"]')
      ?.click();
    popupDocument
      .querySelector<HTMLButtonElement>('[data-action="close"]')
      ?.click();

    expect(popup.print).toHaveBeenCalledOnce();
    expect(popup.close).toHaveBeenCalledOnce();
    expect(popupDocument.querySelector('article')?.textContent).toContain(
      'Body'
    );
    expect(
      [...popupDocument.querySelectorAll('nav button')].map((element) =>
        element.getAttribute('data-action')
      )
    ).toEqual(['print', 'close']);
    const css = styleOf(popupDocument, '--wp-bg');
    expect(css).toMatch(/nav\{[^}]*display: ?flex/);
    expect(css).toMatch(/nav\{[^}]*justify-content: ?flex-end/);
    expect(css).toMatch(/nav\{[^}]*gap: ?\.5rem/);
  });

  it('keeps screen colours readable in a dark colour scheme', () => {
    const { popup, popupDocument } = createPopup();
    openPreview(() => popup, 'task-id', 'Guide');
    const css = styleOf(popupDocument, '--wp-bg');
    const dark = block(css, '@media screen and (prefers-color-scheme:dark)');

    for (const token of ['--wp-bg', '--wp-fg', '--wp-muted', '--wp-line']) {
      expect(css).toContain(`${token}:`);
      expect(dark).toContain(token);
    }
    expect(css).toMatch(
      /body\{[^}]*background: ?var\(--wp-bg\)[^}]*color: ?var\(--wp-fg\)/
    );
    expect(css).toMatch(/nav\{[^}]*background: ?var\(--wp-bg\)/);
    expect(css).toMatch(/aside\{[^}]*color: ?var\(--wp-muted\)/);
    expect(css).toMatch(/button\{[^}]*border: ?1px solid var\(--wp-line\)/);
  });

  it('forces black on white when printing and keeps the print layout', () => {
    const { popup, popupDocument } = createPopup();
    openPreview(() => popup, 'task-id', 'Guide');
    const print = block(styleOf(popupDocument, '--wp-bg'), '@media print');

    expect(print).toMatch(/body\{[^}]*background: ?#fff/);
    expect(print).toMatch(/body\{[^}]*color: ?#000/);
    expect(print).toMatch(/nav, ?aside\{[^}]*display: ?none/);
    expect(print).toMatch(/body\{[^}]*max-width: ?none/);
  });

  it('accepts cancellation only from its popup with the matching task ID', () => {
    const { popup, popupDocument } = createPopup();
    const preview = openPreview(() => popup, 'task-id', 'Guide');

    popupDocument
      .querySelector<HTMLButtonElement>('[data-action="cancel"]')
      ?.click();
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: { type: 'web-printer:cancel', taskId: 'task-id' },
      })
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        source: popup as unknown as Window,
        data: { type: 'web-printer:cancel', taskId: 'wrong' },
      })
    );

    expect(preview?.isCancelled()).toBe(false);

    window.dispatchEvent(
      new MessageEvent('message', {
        source: popup as unknown as Window,
        data: { type: 'web-printer:cancel', taskId: 'task-id' },
      })
    );

    expect(preview?.isCancelled()).toBe(true);
  });

  it('reports whether the popup was closed', () => {
    const { popup } = createPopup();
    const preview = openPreview(() => popup, 'task-id', 'Guide');
    popup.closed = true;

    expect(preview?.isCancelled()).toBe(false);
    expect(preview?.isClosed()).toBe(true);
  });
});
