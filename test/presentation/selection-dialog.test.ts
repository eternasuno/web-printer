import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createLinkSelector } from '../../src/presentation/selection-dialog';

const candidates = [
  { url: 'https://docs.test/a', label: 'A', path: '/a', order: 0 },
  { url: 'https://docs.test/b', label: 'B', path: '/b', order: 1 },
];

const showModal = vi.fn(() => undefined);
const close = vi.fn(() => undefined);

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = showModal;
  HTMLDialogElement.prototype.close = close;
});

afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

afterEach(() => {
  showModal.mockClear();
  close.mockClear();
  document.body.replaceChildren();
});

const open = () => createLinkSelector(document).select(candidates);

const hostOf = (): HTMLElement => {
  const host = document.querySelector<HTMLElement>(
    '[data-web-printer-dialog-host]'
  );
  if (!host?.shadowRoot) {
    throw new Error('expected a shadow host in the page');
  }

  return host;
};

const rootOf = (): ShadowRoot => hostOf().shadowRoot as ShadowRoot;

const dialogOf = (): HTMLDialogElement => {
  const dialog = rootOf().querySelector('dialog');
  if (!(dialog instanceof HTMLDialogElement)) {
    throw new Error('expected a dialog in the shadow root');
  }

  return dialog;
};

const css = (): string =>
  [...rootOf().querySelectorAll('style')]
    .map((element) => element.textContent ?? '')
    .join('');

const checkboxes = (): HTMLInputElement[] => [
  ...rootOf().querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
];

const action = (name: string): HTMLButtonElement | null =>
  rootOf().querySelector<HTMLButtonElement>(`[data-action="${name}"]`);

const text = (selector: string): string =>
  rootOf().querySelector(selector)?.textContent ?? '';

const block = (source: string, query: string): string => {
  const start = source.indexOf(query);
  if (start < 0) {
    return '';
  }
  const end = source.indexOf('}}', start);

  return source.slice(start, end < 0 ? undefined : end + 2);
};

const tick = (): Promise<unknown> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const openBox = (): void => {
  vi.spyOn(dialogOf(), 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 100, 300, 200)
  );
};

const clickAt = (target: Element, x: number, y: number): void => {
  target.dispatchEvent(
    new MouseEvent('click', { clientX: x, clientY: y, bubbles: true })
  );
};

describe('selection dialog presentation', () => {
  it('renders every candidate unselected in a scrollable list and disables Start', () => {
    void open();
    const list = dialogOf().querySelector('[data-role="list"]');

    expect(showModal).toHaveBeenCalledOnce();
    expect(checkboxes().every((input) => !input.checked)).toBe(true);
    expect(action('start')?.disabled).toBe(true);
    expect(text('[data-role="count"]')).toContain('0 selected');
    expect(dialogOf().textContent).toContain('/a');
    expect(list?.querySelector('[title="https://docs.test/a"]')).not.toBeNull();
    expect(css()).toMatch(/\[data-role="list"\][^{]*\{[^}]*overflow: ?auto/);
  });

  it('centres the dialog inside an isolated shadow root', () => {
    void open();
    const rules = css();

    expect(hostOf().tagName).toBe('DIV');
    expect(hostOf().style.getPropertyValue('all')).toBe('revert');
    expect(hostOf().style.getPropertyPriority('all')).toBe('important');
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.head.querySelectorAll('style')).toHaveLength(0);
    expect(dialogOf().getAttribute('aria-labelledby')).toBe(
      'web-printer-selection-title'
    );
    expect(rules).toMatch(/:host\{[^}]*all: ?revert/);
    expect(rules).toMatch(/dialog\{[^}]*position: ?fixed/);
    expect(rules).toMatch(/margin: ?auto/);
    expect(rules).toMatch(/background: ?#fff/);
    expect(rules).toMatch(/dialog::backdrop/);
  });

  it('keeps every dialog surface readable in a dark colour scheme', () => {
    void open();
    const rules = css();
    const dark = block(rules, '@media (prefers-color-scheme:dark)');

    expect(rules).toMatch(/all: ?revert;color-scheme: ?light dark/);
    expect(dark).not.toBe('');
    expect(dark).toContain('background:#151515');
    expect(dark).toContain('border-color:#4a4a4a');
    expect(dark).toContain('color:#eaeaea');
    expect(dark).toContain('border-color:#3a3a3a');
    expect(dark).toContain('color:#a8a8a8');
    expect(dark).toContain('background:#2a2a2a');
    expect(dark).toContain('button:disabled{color:#8a8a8a}');
  });

  it('keeps bulk actions top right and Start bottom right without Close', () => {
    void open();

    expect(text('[data-role="header"]')).toContain('Select pages');
    expect(text('[data-role="header"]')).toContain('Select all');
    expect(text('[data-role="header"]')).toContain('Invert selection');
    expect(text('[data-role="footer"]')).toContain('Start');
    expect(action('deselect-all')).toBeNull();
    expect(action('close')).toBeNull();
    expect(
      rootOf().querySelector('[data-role="header"] [data-action="select-all"]')
    ).not.toBeNull();
    expect(
      rootOf().querySelector(
        '[data-role="header"] [data-action="invert-selection"]'
      )
    ).not.toBeNull();
    expect(
      rootOf().querySelector('[data-role="footer"] [data-action="start"]')
    ).not.toBeNull();
  });

  it('inverts the selection instead of only clearing it', () => {
    void open();

    action('invert-selection')?.click();
    expect(checkboxes().every((input) => input.checked)).toBe(true);
    expect(text('[data-role="count"]')).toContain('2 selected');
    expect(action('start')?.disabled).toBe(false);

    action('invert-selection')?.click();
    expect(checkboxes().some((input) => input.checked)).toBe(false);
    expect(action('start')?.disabled).toBe(true);

    checkboxes()[0]?.click();
    action('invert-selection')?.click();
    expect(checkboxes().map((input) => input.checked)).toEqual([false, true]);
  });

  it('selects every candidate with Select all', () => {
    void open();
    action('select-all')?.click();

    expect(checkboxes().every((input) => input.checked)).toBe(true);
    expect(action('start')?.disabled).toBe(false);
  });

  it('closes and resolves null when the backdrop is clicked', async () => {
    const pending = open();
    openBox();

    clickAt(dialogOf(), 50, 50);

    await expect(pending).resolves.toBeNull();
    expect(close).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-web-printer-dialog-host]')).toBeNull();
    expect(document.head.querySelectorAll('style')).toHaveLength(0);
  });

  it('keeps the dialog open for clicks inside its box or on its content', async () => {
    let resolved = false;
    const pending = open().then((pages) => {
      resolved = true;

      return pages;
    });
    openBox();

    clickAt(dialogOf(), 200, 180);
    clickAt(dialogOf().querySelector('[data-role="list"]') as Element, 50, 50);
    await tick();

    expect(resolved).toBe(false);
    expect(dialogOf()).not.toBeNull();

    checkboxes()[0]?.click();
    action('start')?.click();
    await expect(pending).resolves.toEqual([candidates[0]]);
  });

  it('resolves null when dismissed with Escape', async () => {
    const pending = open();

    dialogOf().dispatchEvent(new Event('cancel', { cancelable: true }));

    await expect(pending).resolves.toBeNull();
    expect(document.querySelector('[data-web-printer-dialog-host]')).toBeNull();
  });

  it('resolves selected pages in candidate order', async () => {
    const pending = open();
    checkboxes()[1]?.click();
    checkboxes()[0]?.click();
    action('start')?.click();

    await expect(pending).resolves.toEqual(candidates);
  });
});
