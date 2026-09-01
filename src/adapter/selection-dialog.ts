import type { CandidateLink, SelectionState } from '../entity';
import type { LinkSelector } from '../port';
import {
  createSelection,
  deselectAll,
  selectAll,
  selectedPages,
  toggleSelection,
} from '../usecase/select';

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

const candidateList = (
  page: Document,
  candidates: readonly CandidateLink[],
  change: (url: string) => void
): HTMLElement => {
  const list = page.createElement('div');
  for (const candidate of candidates) {
    const label = page.createElement('label');
    const input = page.createElement('input');
    const path = page.createElement('small');
    input.type = 'checkbox';
    input.value = candidate.url;
    input.addEventListener('change', () => change(candidate.url));
    path.textContent = candidate.path;
    label.title = candidate.url;
    label.append(input, candidate.label, ' ', path);
    list.append(label, page.createElement('br'));
  }

  return list;
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

const select = (
  page: Document,
  candidates: readonly CandidateLink[]
): ReturnType<LinkSelector['select']> =>
  new Promise((resolve) => {
    let state = createSelection(candidates);
    const dialog = page.createElement('dialog');
    const count = page.createElement('p');
    count.setAttribute('data-role', 'count');
    const start = button(page, 'start', 'Start');
    const list = candidateList(page, candidates, (url) => {
      state = toggleSelection(state, url);
      update(dialog, state);
    });
    const finish = (value: ReturnType<typeof selectedPages> | null): void => {
      dialog.remove();
      resolve(value);
    };
    const all = button(page, 'select-all', 'Select all');
    const none = button(page, 'deselect-all', 'Deselect all');
    all.onclick = () => {
      state = selectAll(state);
      update(dialog, state);
    };
    none.onclick = () => {
      state = deselectAll(state);
      update(dialog, state);
    };
    start.onclick = () => finish(selectedPages(state));
    const close = button(page, 'close', 'Close');
    close.onclick = () => finish(null);
    dialog.oncancel = () => finish(null);
    dialog.append('Select pages', count, list, all, none, start, close);
    page.body.append(dialog);
    update(dialog, state);
    dialog.showModal();
  });

export const createLinkSelector = (
  page: Document = document
): LinkSelector => ({
  select: (candidates) => select(page, candidates),
});
