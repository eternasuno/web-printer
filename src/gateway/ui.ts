import type { BatchResult, SourceLink } from '../core/entity';
import { showPreview } from './printer';

const modal = (
  title: string,
): {
  box: HTMLElement;
  finish: (value: unknown) => void;
  setResolver: (resolver: (value: unknown) => void) => void;
} => {
  const root = document.createElement('dialog');
  const box = document.createElement('section');
  const heading = document.createElement('h2');
  const id = `wp-dialog-${Math.random().toString(36).slice(2)}`;
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
  options: { initial?: string; error?: string } = {},
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
    const submit = document.createElement('button');
    submit.textContent = 'Find Links';
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    view.box.append(label, input, error, submit, cancel);
    const finish = (value: string | null): void => {
      view.finish(value);
      resolve(value);
    };
    submit.onclick = () => {
      if (!input.value.trim()) {
        error.textContent = 'XPath is required';
        input.focus();
      } else finish(input.value);
    };
    cancel.onclick = () => finish(null);
    view.setResolver((value) => resolve(value as string | null));
  });

export type LinksDialogResult =
  | { kind: 'selected'; links: SourceLink[] }
  | { kind: 'back' }
  | { kind: 'cancel' };

export const showLinksDialog = (links: SourceLink[]): Promise<LinksDialogResult> =>
  new Promise((resolve) => {
    if (!links.length) return resolve({ kind: 'cancel' });
    const view = modal('Select links');
    const all = document.createElement('input');
    all.type = 'checkbox';
    all.checked = links.every((x) => x.selected);
    const allLabel = document.createElement('label');
    allLabel.append(all, document.createTextNode(' Select all'));
    view.box.append(allLabel);
    const checks = links.map((link) => {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = link.selected;
      const label = document.createElement('label');
      label.append(input, document.createTextNode(` ${link.text}`));
      view.box.append(label);
      input.onchange = () => {
        link.selected = input.checked;
        all.checked = checks.every((x) => x.checked);
        all.indeterminate = !all.checked && checks.some((x) => x.checked);
      };
      return input;
    });
    all.onchange = () =>
      checks.forEach((input, i) => {
        input.checked = all.checked;
        links[i].selected = all.checked;
      });
    const none = document.createElement('button');
    none.textContent = 'Select none';
    none.onclick = () => {
      all.checked = false;
      all.indeterminate = false;
      checks.forEach((input, i) => {
        input.checked = false;
        links[i].selected = false;
      });
    };
    view.box.append(none);
    const confirm = document.createElement('button');
    confirm.textContent = 'Process selected';
    const back = document.createElement('button');
    back.textContent = 'Back';
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    view.box.append(confirm, back, cancel);
    const finish = (value: LinksDialogResult): void => {
      view.finish(value);
      resolve(value);
    };
    view.setResolver((value) => resolve(value as LinksDialogResult));
    confirm.onclick = () => finish({ kind: 'selected', links: links.filter((x) => x.selected) });
    back.onclick = () => finish({ kind: 'back' });
    cancel.onclick = () => finish({ kind: 'cancel' });
  });

export const showProgress = (
  total: number,
  controller: AbortController,
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
  const button = document.createElement('button');
  button.textContent = 'Cancel';
  button.onclick = () => controller.abort();
  root.append(status, button);
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
  setTimeout(() => toast.remove(), 5000);
};
export const showPreviewButton = (result: BatchResult): void => {
  const button = document.createElement('button');
  button.textContent = 'Open Preview';
  button.onclick = () => {
    const target = window.open('', '_blank');
    if (target) {
      target.opener = null;
      showPreview(target, result);
    } else showToast('Popup blocked; click Open Preview again');
  };
  document.body.append(button);
};
