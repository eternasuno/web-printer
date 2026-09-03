import type { CandidateLink, SelectedPage, SelectionState } from '../entity';
import {
  createSelection,
  invertSelection,
  selectAll,
  selectedPages,
  toggleSelection,
} from '../usecase/select';

interface LinkSelector {
  select(candidates: readonly CandidateLink[]): Promise<SelectedPage[] | null>;
}

const hostAttribute = 'data-web-printer-dialog-host';

const sheet = `
:host{all:revert;color-scheme:light dark}
dialog{position:fixed;inset:0;margin:auto;display:flex;flex-direction:column;box-sizing:border-box;width:min(36rem,90vw);max-height:min(28rem,80vh);padding:0;border:1px solid #ccc;border-radius:.5rem;background:#fff;color:#111;font:14px/1.5 system-ui,sans-serif;text-align:start;box-shadow:0 1rem 2rem rgba(0,0,0,.25)}
dialog::backdrop{background:rgba(0,0,0,.4)}
[data-role="header"],[data-role="footer"]{display:flex;align-items:center;gap:.5rem;padding:.75rem 1rem}
[data-role="header"]{border-bottom:1px solid #ddd}
[data-role="footer"]{justify-content:flex-end;border-top:1px solid #ddd}
[data-role="actions"]{display:flex;gap:.5rem;margin-left:auto}
h2{margin:0;font-size:1rem;font-weight:600}
p{margin:0;color:#555}
[data-role="list"]{flex:1;min-height:0;overflow:auto;padding:.5rem 1rem}
[data-role="list"] label{display:flex;gap:.5rem;align-items:baseline;padding:.2rem 0}
small{color:#555;font-size:12px}
button{padding:.25rem .6rem;border:1px solid #ccc;border-radius:.25rem;background:#f5f5f5;color:#111;font:inherit;cursor:pointer}
button:disabled{color:#999;cursor:default}
@media (prefers-color-scheme:dark){dialog{background:#151515;border-color:#4a4a4a;color:#eaeaea}[data-role="header"],[data-role="footer"]{border-color:#3a3a3a}p,small{color:#a8a8a8}button{background:#2a2a2a;border-color:#4a4a4a;color:#eaeaea}button:disabled{color:#8a8a8a}}
`;

const button = (
  page: Document,
  action: string,
  text: string
): HTMLButtonElement => {
  const element = page.createElement('button');
  element.type = 'button';
  element.setAttribute('data-action', action);
  element.textContent = text;

  return element;
};

const region = (
  page: Document,
  role: string,
  children: readonly Element[]
): HTMLElement => {
  const element = page.createElement('div');
  element.setAttribute('data-role', role);
  element.append(...children);

  return element;
};

const candidateList = (
  page: Document,
  candidates: readonly CandidateLink[]
): HTMLElement => {
  const items = candidates.map((candidate) => {
    const input = page.createElement('input');
    const path = page.createElement('small');
    input.type = 'checkbox';
    input.value = candidate.url;
    path.textContent = candidate.path;
    const label = page.createElement('label');
    label.title = candidate.url;
    label.append(input, candidate.label, ' ', path);

    return label;
  });

  return region(page, 'list', items);
};

const header = (
  page: Document,
  actions: readonly HTMLButtonElement[]
): HTMLElement => {
  const title = page.createElement('h2');
  title.id = 'web-printer-selection-title';
  title.textContent = 'Select pages';
  const count = page.createElement('p');
  count.setAttribute('data-role', 'count');

  return region(page, 'header', [
    title,
    count,
    region(page, 'actions', actions),
  ]);
};

const markup = (
  page: Document,
  candidates: readonly CandidateLink[]
): HTMLDialogElement => {
  const start = button(page, 'start', 'Start');
  const dialog = page.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'web-printer-selection-title');
  dialog.append(
    header(page, [
      button(page, 'select-all', 'Select all'),
      button(page, 'invert-selection', 'Invert selection'),
    ]),
    candidateList(page, candidates),
    region(page, 'footer', [start])
  );

  return dialog;
};

const update = (dialog: HTMLDialogElement, state: SelectionState): void => {
  for (const input of dialog.querySelectorAll<HTMLInputElement>('input')) {
    input.checked = state.selected.has(input.value);
  }
  const count = dialog.querySelector('[data-role="count"]');
  const start = dialog.querySelector<HTMLButtonElement>(
    '[data-action="start"]'
  );
  if (count) {
    count.textContent = `${state.selected.size} selected`;
  }
  if (start) {
    start.disabled = !state.canStart;
  }
};

const onBackdrop = (dialog: HTMLDialogElement, x: number, y: number) => {
  const box = dialog.getBoundingClientRect();

  return x < box.left || x > box.right || y < box.top || y > box.bottom;
};

const mount = (
  page: Document,
  candidates: readonly CandidateLink[]
): { dialog: HTMLDialogElement; host: HTMLElement } => {
  const host = page.createElement('div');
  host.setAttribute(hostAttribute, '');
  host.style.setProperty('all', 'revert', 'important');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = page.createElement('style');
  style.textContent = sheet;
  const dialog = markup(page, candidates);
  shadow.append(style, dialog);
  page.body.append(host);

  return { dialog, host };
};

const select = (
  page: Document,
  candidates: readonly CandidateLink[]
): ReturnType<LinkSelector['select']> =>
  new Promise((resolve) => {
    const { dialog, host } = mount(page, candidates);
    let state = createSelection(candidates);
    const refresh = (
      next: (current: SelectionState) => SelectionState
    ): void => {
      state = next(state);
      update(dialog, state);
    };
    const finish = (value: SelectedPage[] | null): void => {
      dialog.close();
      host.remove();
      resolve(value);
    };
    const bind = (action: string, handler: () => void): void => {
      const element = dialog.querySelector<HTMLButtonElement>(
        `[data-action="${action}"]`
      );
      if (element) {
        element.onclick = handler;
      }
    };

    bind('select-all', () => refresh(selectAll));
    bind('invert-selection', () => refresh(invertSelection));
    bind('start', () => finish(selectedPages(state)));
    for (const input of dialog.querySelectorAll<HTMLInputElement>('input')) {
      input.addEventListener('change', () =>
        refresh((current) => toggleSelection(current, input.value))
      );
    }
    dialog.onclick = (event) => {
      if (
        event.target === dialog &&
        onBackdrop(dialog, event.clientX, event.clientY)
      ) {
        finish(null);
      }
    };
    dialog.oncancel = () => finish(null);
    update(dialog, state);
    dialog.showModal();
  });

export const createLinkSelector = (
  page: Document = document
): LinkSelector => ({
  select: (candidates) => select(page, candidates),
});
