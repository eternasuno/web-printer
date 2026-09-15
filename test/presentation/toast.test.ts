import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNotifier } from '../../src/presentation/toast';

const toasts = (): NodeListOf<Element> =>
  document.querySelectorAll('[data-web-printer-toast]');

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('createNotifier', () => {
  it('appends a toast with the message and a status role', () => {
    createNotifier(document).show('hello');

    const toast = toasts()[0];
    expect(toasts()).toHaveLength(1);
    expect(toast?.textContent).toBe('hello');
    expect(toast?.getAttribute('role')).toBe('status');
  });

  it('replaces the previous toast on a second show', () => {
    const notifier = createNotifier(document);
    notifier.show('first');
    notifier.show('second');

    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]?.textContent).toBe('second');
  });

  it('removes the toast on click', () => {
    createNotifier(document).show('hello');
    toasts()[0]?.dispatchEvent(new MouseEvent('click'));

    expect(toasts()).toHaveLength(0);
  });

  it('removes the toast after the duration', () => {
    vi.useFakeTimers();
    createNotifier(document).show('hello');

    vi.advanceTimersByTime(4_000);

    expect(toasts()).toHaveLength(0);
  });
});
