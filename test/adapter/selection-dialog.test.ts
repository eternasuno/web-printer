import { afterEach, describe, expect, it } from 'vitest';
import { createLinkSelector } from '../../src/adapter/selection-dialog';

const candidates = [
  { url: 'https://docs.test/a', label: 'A', path: '/a', order: 0 },
  { url: 'https://docs.test/b', label: 'B', path: '/b', order: 1 },
];

afterEach(() => {
  document.body.replaceChildren();
});

describe('selection dialog adapter', () => {
  it('renders every candidate unselected and disables Start', () => {
    void createLinkSelector(document).select(candidates);
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]'
    );
    const start = document.querySelector<HTMLButtonElement>(
      '[data-action="start"]'
    );

    expect([...checkboxes].every((input) => !input.checked)).toBe(true);
    expect(start?.disabled).toBe(true);
    expect(document.body.textContent).toContain('/a');
    expect(
      document.querySelector('[title="https://docs.test/a"]')
    ).not.toBeNull();
  });

  it('selects and deselects all candidates and updates Start', () => {
    void createLinkSelector(document).select(candidates);
    const selectAll = document.querySelector<HTMLButtonElement>(
      '[data-action="select-all"]'
    );
    const deselectAll = document.querySelector<HTMLButtonElement>(
      '[data-action="deselect-all"]'
    );
    const start = document.querySelector<HTMLButtonElement>(
      '[data-action="start"]'
    );

    selectAll?.click();
    expect(
      [
        ...document.querySelectorAll<HTMLInputElement>(
          'input[type="checkbox"]'
        ),
      ].every((input) => input.checked)
    ).toBe(true);
    expect(start?.disabled).toBe(false);

    deselectAll?.click();
    expect(start?.disabled).toBe(true);
  });

  it('resolves selected pages in candidate order', async () => {
    const pending = createLinkSelector(document).select(candidates);
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]'
    );
    checkboxes[1]?.click();
    checkboxes[0]?.click();
    document.querySelector<HTMLButtonElement>('[data-action="start"]')?.click();

    await expect(pending).resolves.toEqual(candidates);
  });
});
