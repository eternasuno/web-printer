import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  showLinksDialog,
  showPreviewButton,
  showProgress,
  showXPathDialog,
} from '../../src/gateway/ui';

const click = (text: string) =>
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent === text)
    ?.click();

describe('UI gateways', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  it('validates XPath and resolves submitted input', async () => {
    const promise = showXPathDialog();
    click('Find Links');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'required'
    );
    const input = document.querySelector('input') as HTMLInputElement;
    input.value = '//main//a';
    click('Find Links');
    await expect(promise).resolves.toBe('//main//a');
    expect(document.querySelector('dialog')).toBeNull();
  });
  it('supports selection, indeterminate select-all, and cancel', async () => {
    const links = [
      { text: 'A', url: 'https://a.test' },
      { text: 'B', url: 'https://b.test' },
    ];
    const promise = showLinksDialog(links);
    const checks = [
      ...document.querySelectorAll('input[type="checkbox"]'),
    ] as HTMLInputElement[];
    checks[1]?.click();
    expect(checks[0]?.indeterminate).toBe(true);
    click('Process selected');
    await expect(promise).resolves.toEqual({
      kind: 'selected',
      links: [links[1]],
    });
    expect(document.querySelector('dialog')).toBeNull();
    await expect(showLinksDialog([])).resolves.toEqual({ kind: 'cancel' });
  });
  it('updates progress, cancels, and removes progress UI', () => {
    const controller = new AbortController();
    const view = showProgress(2, controller);
    view.update({ completed: 1, succeeded: 1, failed: 0 });
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      '1/2'
    );
    click('Cancel');
    expect(controller.signal.aborted).toBe(true);
    view.close();
    expect(document.querySelector('.wp-progress')).toBeNull();
  });
  it('opens a native modal dialog and handles cancellation', async () => {
    const promise = showXPathDialog();
    const dialog = document.querySelector('dialog');
    expect(dialog?.open).toBe(true);
    dialog?.dispatchEvent(new Event('cancel', { cancelable: true }));
    await expect(promise).resolves.toBeNull();
  });
  it('detaches the opener before rendering the preview', () => {
    const target = {
      document: document.implementation.createHTMLDocument(),
      print: vi.fn(),
      opener: window,
    } as unknown as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(target);
    showPreviewButton({ articles: [], failures: [] });
    click('Open Preview');
    expect(target.opener).toBeNull();
    expect(
      target.document.querySelector('[data-web-printer-preview]')
    ).toBeTruthy();
    open.mockRestore();
  });
});

it('does not require dynamic import for preview button', async () => {
  vi.spyOn(window, 'open').mockReturnValue(null);
  const { showPreviewButton } = await import('../../src/gateway/ui');
  showPreviewButton({ articles: [], failures: [] });
  click('Open Preview');
});
