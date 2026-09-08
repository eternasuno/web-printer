import { describe, expect, it, vi } from 'vitest';
import type { Link, Post } from '../../src/entity';
import { openPreview } from '../../src/presentation/preview-window';

const link = (id: number, label: string): Link => ({
  id,
  url: `https://docs.test/${label}`,
  label,
  path: `/${label}`,
});

const success = (label: string): Post => ({
  type: 'success',
  link: link(0, label),
  title: `Title ${label}`,
  contentHtml: `<p>${label}</p>`,
  sourceUrl: `https://docs.test/${label}`,
});

const failure = (label: string, reason: string): Post => ({
  type: 'failure',
  link: link(1, label),
  reason,
});

const createPopup = () => {
  const popupDocument = document.implementation.createHTMLDocument();
  let onPageHide: EventListener | undefined;
  const popup = {
    document: popupDocument,
    closed: false,
    close: vi.fn(() => {
      popup.closed = true;
    }),
    print: vi.fn(),
    postMessage: vi.fn(),
    opener: { postMessage: vi.fn() },
    addEventListener: vi.fn((type: string, listener: unknown) => {
      if (type === 'pagehide' && typeof listener === 'function') {
        onPageHide = listener as EventListener;
      }
    }),
    removeEventListener: vi.fn((type: string) => {
      if (type === 'pagehide') {
        onPageHide = undefined;
      }
    }),
  };

  return {
    popup,
    popupDocument,
    pageHide: () => onPageHide?.call(popup, new Event('pagehide')),
  };
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

const cancelMessage = (popup: object, taskId = 'task-id'): MessageEvent =>
  new MessageEvent('message', {
    source: popup as Window,
    data: { type: 'web-printer:cancel', taskId },
  });

describe('preview window presentation', () => {
  it('should return null when the browser blocks the popup', () => {
    expect(openPreview(() => null, 'task-id', 'Guide', vi.fn())).toBeNull();
  });

  it('should show progress and support Print and Close after rendering', () => {
    const { popup, popupDocument } = createPopup();
    const preview = openPreview(() => popup, 'task-id', 'Guide', vi.fn());

    preview?.update({ completed: 2, total: 4 });
    expect(popupDocument.body.textContent).toContain('fetching 2 / 4');

    preview?.render({
      title: 'Guide',
      posts: [success('Page')],
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
      'Page'
    );
    expect(popupDocument.querySelector('article div')?.innerHTML).toBe(
      '<p>Page</p>'
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

  it('should derive the summary counts and failure details from the posts', () => {
    const { popup, popupDocument } = createPopup();
    const preview = openPreview(() => popup, 'task-id', 'Guide', vi.fn());

    preview?.render({
      title: 'Guide',
      posts: [
        success('One'),
        failure('Two', 'HTTP 404'),
        failure('Three', 'Timeout'),
      ],
    });
    const aside = popupDocument.querySelector('aside');

    expect(aside?.textContent).toContain('1 succeeded, 2 failed');
    expect(aside?.querySelectorAll('p')).toHaveLength(2);
    expect(aside?.querySelector('p')?.textContent).toBe(
      'Two: HTTP 404 (https://docs.test/Two)'
    );
  });

  it('should break every page after the first and mark failures as placeholders', () => {
    const { popup, popupDocument } = createPopup();
    const preview = openPreview(() => popup, 'task-id', 'Guide', vi.fn());

    preview?.render({
      title: 'Guide',
      posts: [success('One'), failure('Two', 'HTTP 404'), success('Three')],
    });
    const articles = [...popupDocument.querySelectorAll('article')];

    expect(articles.map((item) => item.classList.contains('break'))).toEqual([
      false,
      true,
      true,
    ]);
    expect(
      articles.map((item) => item.classList.contains('placeholder'))
    ).toEqual([false, true, false]);
    expect(articles.at(1)?.textContent).toContain('Two');
    expect(articles.at(1)?.textContent).toContain('HTTP 404');
  });

  it('should keep screen colours readable in a dark colour scheme', () => {
    const { popup, popupDocument } = createPopup();
    openPreview(() => popup, 'task-id', 'Guide', vi.fn());
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

  it('should force black on white when printing and keep the print layout', () => {
    const { popup, popupDocument } = createPopup();
    openPreview(() => popup, 'task-id', 'Guide', vi.fn());
    const print = block(styleOf(popupDocument, '--wp-bg'), '@media print');

    expect(print).toMatch(/body\{[^}]*background: ?#fff/);
    expect(print).toMatch(/body\{[^}]*color: ?#000/);
    expect(print).toMatch(/nav, ?aside\{[^}]*display: ?none/);
    expect(print).toMatch(/body\{[^}]*max-width: ?none/);
  });

  it('should accept cancellation only from its popup with the matching task ID', () => {
    const { popup } = createPopup();
    const onCancel = vi.fn();
    openPreview(() => popup, 'task-id', 'Guide', onCancel);

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: { type: 'web-printer:cancel', taskId: 'task-id' },
      })
    );
    window.dispatchEvent(cancelMessage(popup, 'wrong'));
    expect(onCancel).not.toHaveBeenCalled();

    window.dispatchEvent(cancelMessage(popup));
    window.dispatchEvent(cancelMessage(popup));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it('should cancel once and drop listeners when the popup is closed directly', () => {
    const { popup, pageHide } = createPopup();
    const onCancel = vi.fn();
    const removeMessage = vi.spyOn(window, 'removeEventListener');
    openPreview(() => popup, 'task-id', 'Guide', onCancel);

    pageHide();
    pageHide();
    window.dispatchEvent(cancelMessage(popup));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(popup.close).toHaveBeenCalledOnce();
    expect(popup.removeEventListener).toHaveBeenCalledWith(
      'pagehide',
      expect.any(Function)
    );
    expect(removeMessage).toHaveBeenCalledWith('message', expect.any(Function));
    removeMessage.mockRestore();
  });

  it('should not cancel when the popup is closed after the preview renders', () => {
    const { popup, pageHide } = createPopup();
    const onCancel = vi.fn();
    const preview = openPreview(() => popup, 'task-id', 'Guide', onCancel);

    preview?.render({ title: 'Guide', posts: [] });
    pageHide();

    expect(onCancel).not.toHaveBeenCalled();
    expect(popup.removeEventListener).toHaveBeenCalledWith(
      'pagehide',
      expect.any(Function)
    );
  });
});
