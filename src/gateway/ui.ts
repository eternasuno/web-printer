import type { BatchResult, SourceLink } from '../core/entity';
import { showPreview } from './printer';

export type LinksDialogResult =
  | { kind: 'selected'; links: SourceLink[] }
  | { kind: 'back' }
  | { kind: 'cancel' };
export type XPathOptions = {
  initial?: string | undefined;
  error?: string | undefined;
};

const toastLifetime = 5000;
let dialogCount = 0;

const button = (text: string, onclick: () => void): HTMLButtonElement => {
  const element = document.createElement('button');
  element.textContent = text;
  element.onclick = onclick;
  return element;
};

type CheckRow = { row: HTMLLabelElement; input: HTMLInputElement };

const checkboxRow = (labelText: string): CheckRow => {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = true;
  const row = document.createElement('label');
  row.append(input, document.createTextNode(` ${labelText}`));
  return { row, input };
};

const applyChecks = (
  value: boolean,
  checks: HTMLInputElement[],
  selected: boolean[]
): void => {
  selected.fill(value);
  for (const input of checks) input.checked = value;
};

const modal = (
  title: string
): {
  box: HTMLElement;
  finish: (value: unknown) => void;
  setResolver: (resolver: (value: unknown) => void) => void;
} => {
  const root = document.createElement('dialog');
  const box = document.createElement('section');
  const heading = document.createElement('h2');
  const id = `wp-dialog-${dialogCount++}`;
  heading.id = id;
  heading.textContent = title;
  root.setAttribute('aria-labelledby', id);
  box.append(heading);
  root.append(box);
  document.body.append(root);
  const previous = document.activeElement as HTMLElement | null;
  let done = false;
  let resolver: ((value: unknown) => void) | undefined;
  const finish = (value: unknown): void => {
    if (done) return;
    done = true;
    root.close();
    root.remove();
    previous?.focus();
    resolver?.(value);
  };
  root.addEventListener('cancel', (event) => {
    event.preventDefault();
    finish(null);
  });
  root.showModal();

  return {
    box,
    finish,
    setResolver: (next) => {
      resolver = next;
    },
  };
};

export const showXPathDialog = (
  options: XPathOptions = {}
): Promise<string | null> =>
  new Promise((resolve) => {
    const view = modal('Find links');
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '//nav//a[@href]';
    input.value = options.initial ?? '';
    const label = document.createElement('label');
    label.htmlFor = 'wp-xpath-input';
    label.textContent = 'XPath expression';
    input.id = 'wp-xpath-input';
    const error = document.createElement('div');
    error.id = 'wp-xpath-error';
    error.setAttribute('role', 'alert');
    error.textContent = options.error ?? '';
    input.setAttribute('aria-describedby', error.id);
    const finish = (value: string | null): void => {
      view.finish(value);
      resolve(value);
    };
    view.box.append(
      label,
      input,
      error,
      button('Find Links', () => {
        if (!input.value.trim()) {
          error.textContent = 'XPath is required';
          input.focus();
        } else {
          finish(input.value);
        }
      }),
      button('Cancel', () => finish(null))
    );
    view.setResolver((value) => resolve(value as string | null));
  });

const wireLinksDialog = (
  box: HTMLElement,
  links: SourceLink[],
  finish: (value: LinksDialogResult) => void
): void => {
  const selected = links.map(() => true);
  const allRow = checkboxRow('Select all');
  const all = allRow.input;
  all.checked = selected.every(Boolean);
  const rows = links.map((link) => checkboxRow(link.text));
  const checks = rows.map((row) => row.input);
  const sync = (): void => {
    all.checked = checks.every((x) => x.checked);
    all.indeterminate = !all.checked && checks.some((x) => x.checked);
  };
  const apply = (value: boolean): void => applyChecks(value, checks, selected);
  for (const [index, row] of rows.entries()) {
    row.input.onchange = () => {
      selected[index] = row.input.checked;
      sync();
    };
  }
  all.onchange = () => {
    all.indeterminate = false;
    apply(all.checked);
  };
  box.append(
    allRow.row,
    ...rows.map((row) => row.row),
    button('Select none', () => {
      all.checked = false;
      all.indeterminate = false;
      apply(false);
    }),
    button('Process selected', () =>
      finish({
        kind: 'selected',
        links: links.filter((_, index) => selected[index]),
      })
    ),
    button('Back', () => finish({ kind: 'back' })),
    button('Cancel', () => finish({ kind: 'cancel' }))
  );
};

export const showLinksDialog = (
  links: SourceLink[]
): Promise<LinksDialogResult> =>
  new Promise((resolve) => {
    if (!links.length) return resolve({ kind: 'cancel' });
    const view = modal('Select links');
    const finish = (value: LinksDialogResult): void => {
      view.finish(value);
      resolve(value);
    };
    wireLinksDialog(view.box, links, finish);
    view.setResolver((value) => resolve(value as LinksDialogResult));
  });

export const showProgress = (
  total: number,
  controller: AbortController
): {
  update(value: { completed: number; succeeded: number; failed: number }): void;
  close(): void;
} => {
  const root = document.createElement('div');
  root.className = 'wp-progress';
  root.setAttribute('role', 'progressbar');
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', String(total));
  const status = document.createElement('div');
  status.setAttribute('role', 'status');
  root.append(
    status,
    button('Cancel', () => controller.abort())
  );
  document.body.append(root);
  return {
    update: (value) => {
      status.textContent = `Completed ${value.completed}/${total}; succeeded ${value.succeeded}; failed ${value.failed}`;
      root.setAttribute('aria-valuenow', String(value.completed));
    },
    close: () => root.remove(),
  };
};

export const showToast = (message: string): void => {
  const toast = document.createElement('div');
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), toastLifetime);
};

export const showPreviewButton = (result: BatchResult): void => {
  document.body.append(
    button('Open Preview', () => {
      const target = window.open('', '_blank');
      if (!target) {
        showToast('Popup blocked; click Open Preview again');
        return;
      }
      target.opener = null;
      showPreview(target, result);
    })
  );
};
