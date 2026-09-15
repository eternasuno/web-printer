import type { Link } from '../entity';
import {
  invertSelection,
  type SelectedIds,
  selectAll,
  selectedLinks,
  toggleSelection,
} from '../usecase/select';
import { button } from './dom';

interface Refine {
  readonly selector: string;
  readonly rediscover: (selector: string) => Link[];
}

interface LinkSelector {
  select(links: readonly Link[], refine?: Refine): Promise<Link[] | null>;
}

type RefineRefs = {
  readonly input: HTMLInputElement;
  readonly hint: HTMLElement;
  readonly apply: HTMLButtonElement;
};

type DialogRefs = {
  readonly selectAll: HTMLButtonElement;
  readonly invert: HTMLButtonElement;
  readonly start: HTMLButtonElement;
  readonly count: HTMLElement;
  readonly list: HTMLElement;
  readonly refine: RefineRefs | null;
};

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
[data-role="refine"]{display:flex;flex-wrap:wrap;gap:.5rem;padding:.5rem 1rem;border-bottom:1px solid #ddd}
[data-role="refine"] input{flex:1;min-width:0;padding:.25rem .5rem;border:1px solid #ccc;border-radius:.25rem;background:#fff;color:#111;font:inherit}
[data-role="hint"]{flex-basis:100%;color:#b00;font-size:12px}
small{color:#555;font-size:12px}
button{padding:.25rem .6rem;border:1px solid #ccc;border-radius:.25rem;background:#f5f5f5;color:#111;font:inherit;cursor:pointer}
button:disabled{color:#999;cursor:default}
@media (prefers-color-scheme:dark){dialog{background:#151515;border-color:#4a4a4a;color:#eaeaea}[data-role="header"],[data-role="footer"],[data-role="refine"]{border-color:#3a3a3a}[data-role="refine"] input{background:#2a2a2a;border-color:#4a4a4a;color:#eaeaea}[data-role="hint"]{color:#ff9a9a}p,small{color:#a8a8a8}button{background:#2a2a2a;border-color:#4a4a4a;color:#eaeaea}button:disabled{color:#8a8a8a}}
`;

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

const listItems = (page: Document, links: readonly Link[]): HTMLElement[] =>
  links.map((link) => {
    const input = page.createElement('input');
    const path = page.createElement('small');
    input.type = 'checkbox';
    input.value = String(link.id);
    path.textContent = link.path;
    const label = page.createElement('label');
    label.title = link.url;
    label.append(input, link.label, ' ', path);

    return label;
  });

const linkList = (page: Document, links: readonly Link[]): HTMLElement =>
  region(page, 'list', listItems(page, links));

const refineRow = (
  page: Document,
  selector: string
): RefineRefs & { row: HTMLElement } => {
  const input = page.createElement('input');
  input.type = 'search';
  input.setAttribute('data-role', 'selector');
  input.setAttribute('aria-label', 'CSS selector');
  input.placeholder = 'CSS selector, e.g. nav a';
  input.value = selector;
  const hint = page.createElement('p');
  hint.setAttribute('data-role', 'hint');
  hint.setAttribute('aria-live', 'polite');
  const apply = button(page, 'apply-selector', 'Apply');

  return {
    row: region(page, 'refine', [input, apply, hint]),
    input,
    hint,
    apply,
  };
};

const header = (
  page: Document,
  actions: readonly HTMLButtonElement[]
): { row: HTMLElement; count: HTMLElement } => {
  const title = page.createElement('h2');
  title.id = 'web-printer-selection-title';
  title.textContent = 'Select pages';
  const count = page.createElement('p');
  count.setAttribute('data-role', 'count');

  return {
    row: region(page, 'header', [
      title,
      count,
      region(page, 'actions', actions),
    ]),
    count,
  };
};

const markup = (
  page: Document,
  links: readonly Link[],
  refine?: Refine
): { dialog: HTMLDialogElement; refs: DialogRefs } => {
  const selectAllButton = button(page, 'select-all', 'Select all');
  const invert = button(page, 'invert-selection', 'Invert selection');
  const start = button(page, 'start', 'Start');
  const { row: headerRow, count } = header(page, [selectAllButton, invert]);
  const refineRefs = refine ? refineRow(page, refine.selector) : null;
  const list = linkList(page, links);
  const dialog = page.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'web-printer-selection-title');
  dialog.append(
    headerRow,
    ...(refineRefs ? [refineRefs.row] : []),
    list,
    region(page, 'footer', [start])
  );

  return {
    dialog,
    refs: {
      selectAll: selectAllButton,
      invert,
      start,
      count,
      list,
      refine: refineRefs,
    },
  };
};

const update = (refs: DialogRefs, selectedIds: SelectedIds): void => {
  const { count, start, list } = refs;
  for (const input of list.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"]'
  )) {
    input.checked = selectedIds.has(Number(input.value));
  }
  count.textContent = `${selectedIds.size} selected`;
  start.disabled = selectedIds.size === 0;
};

const isOutside = (dialog: HTMLDialogElement, x: number, y: number) => {
  const box = dialog.getBoundingClientRect();

  return x < box.left || x > box.right || y < box.top || y > box.bottom;
};

const clickedOutside = (
  dialog: HTMLDialogElement,
  event: MouseEvent
): boolean =>
  event.target === dialog && isOutside(dialog, event.clientX, event.clientY);

const mount = (
  page: Document,
  links: readonly Link[],
  refine?: Refine
): { dialog: HTMLDialogElement; host: HTMLElement; refs: DialogRefs } => {
  const host = page.createElement('div');
  host.setAttribute(hostAttribute, '');
  host.style.setProperty('all', 'revert', 'important');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = page.createElement('style');
  style.textContent = sheet;
  const { dialog, refs } = markup(page, links, refine);
  shadow.append(style, dialog);
  page.body.append(host);

  return { dialog, host, refs };
};

const preservedSelection = (
  links: readonly Link[],
  selectedIds: SelectedIds,
  next: readonly Link[]
): SelectedIds => {
  const kept = new Set(selectedLinks(links, selectedIds).map((l) => l.url));

  return new Set(next.filter((l) => kept.has(l.url)).map((l) => l.id));
};

const rediscoverSafe = (refine: Refine, query: string): Link[] | null => {
  try {
    return refine.rediscover(query);
  } catch {
    return null;
  }
};

const bindRefine = (
  { input, hint, apply }: RefineRefs,
  rebuild: (query: string) => string
): void => {
  const run = (): void => {
    hint.textContent = rebuild(input.value.trim() || 'a[href]');
  };
  apply.addEventListener('click', run);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      run();
    }
  });
};

const bindToggle = (
  list: Element | null,
  onToggle: (id: number) => void
): void => {
  list?.addEventListener('change', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      onToggle(Number(input.value));
    }
  });
};

const bindDismiss = (dialog: HTMLDialogElement, finish: () => void): void => {
  dialog.addEventListener('click', (event) => {
    if (clickedOutside(dialog, event)) {
      finish();
    }
  });
  dialog.addEventListener('cancel', () => finish());
};

const select = (
  page: Document,
  initialLinks: readonly Link[],
  refine?: Refine
): ReturnType<LinkSelector['select']> =>
  new Promise((resolve) => {
    let links = initialLinks;
    const { dialog, host, refs } = mount(page, links, refine);
    let selectedIds: SelectedIds = selectAll(links);
    const refresh = (next: SelectedIds): void => {
      selectedIds = next;
      update(refs, selectedIds);
    };
    const finish = (value: Link[] | null): void => {
      dialog.close();
      host.remove();
      resolve(value);
    };
    const rebuild = (query: string): string => {
      const next = refine ? rediscoverSafe(refine, query) : null;
      if (!next?.length) {
        return next ? `No links match "${query}"` : 'Invalid selector';
      }

      selectedIds = preservedSelection(links, selectedIds, next);
      links = next;
      refs.list.replaceChildren(...listItems(page, next));
      update(refs, selectedIds);

      return '';
    };

    refs.selectAll.onclick = () => refresh(selectAll(links));
    refs.invert.onclick = () => refresh(invertSelection(links, selectedIds));
    refs.start.onclick = () => finish(selectedLinks(links, selectedIds));
    bindToggle(refs.list, (id) =>
      refresh(toggleSelection(links, selectedIds, id))
    );
    if (refs.refine) {
      bindRefine(refs.refine, rebuild);
    }
    bindDismiss(dialog, () => finish(null));
    update(refs, selectedIds);
    dialog.showModal();
  });

export const createLinkSelector = (
  page: Document = document
): LinkSelector => ({
  select: (links, refine) => select(page, links, refine),
});
