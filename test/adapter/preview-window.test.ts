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
  });

  it('accepts cancellation only from its popup with the matching task ID', () => {
    const { popup, popupDocument } = createPopup();
    const preview = openPreview(() => popup, 'task-id', 'Guide');
    const cancel = vi.fn();
    preview?.onCancel(cancel);

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

    expect(cancel).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent('message', {
        source: popup as unknown as Window,
        data: { type: 'web-printer:cancel', taskId: 'task-id' },
      })
    );

    expect(cancel).toHaveBeenCalledOnce();
  });

  it('reports whether the popup was closed', () => {
    const { popup } = createPopup();
    const preview = openPreview(() => popup, 'task-id', 'Guide');
    popup.closed = true;

    expect(preview?.isClosed()).toBe(true);
  });
});
