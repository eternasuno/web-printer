import type { PrintDocument, PrintItem } from '../entity';
import type { Preview } from '../port';

type Popup = Pick<
  Window,
  'document' | 'closed' | 'close' | 'focus' | 'print' | 'postMessage' | 'opener'
>;
type OpenWindow = () => Popup | null;

const css = `
  :root{--wp-bg:#fff;--wp-fg:#181818;--wp-muted:#555;--wp-line:#ccc;--wp-surface:#f5f5f5}
  body{max-width:52rem;margin:0 auto;padding:2rem;font:16px/1.6 system-ui,sans-serif;background:var(--wp-bg);color:var(--wp-fg)}
  nav{position:sticky;top:0;display:flex;align-items:center;justify-content:flex-end;gap:.5rem;padding:.75rem;background:var(--wp-bg);border-bottom:1px solid var(--wp-line)}
  button{background:var(--wp-surface);color:var(--wp-fg);border:1px solid var(--wp-line);border-radius:.3rem;padding:.4rem .8rem;font:inherit}
  aside{color:var(--wp-muted)}
  article.break{break-before:page}.placeholder{padding:1rem;border:1px solid var(--wp-line)}
  pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--wp-surface);padding:1rem}
  img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}
  th,td{border:1px solid var(--wp-line);padding:.35rem;text-align:left}
  @media screen and (prefers-color-scheme:dark){:root{color-scheme:dark;--wp-bg:#181818;--wp-fg:#eaeaea;--wp-muted:#a8a8a8;--wp-line:#555;--wp-surface:#242424}}
  @media print{:root{color-scheme:light}nav,aside{display:none}body{max-width:none;padding:0;background:#fff;color:#000}}
`;

const action = (
  page: Document,
  name: string,
  label: string
): HTMLButtonElement => {
  const element = page.createElement('button');
  element.type = 'button';
  element.setAttribute('data-action', name);
  element.textContent = label;

  return element;
};

const renderItem = (page: Document, item: PrintItem): HTMLElement => {
  const element = page.createElement('article');
  if (item.breakBefore) {
    element.classList.add('break');
  }
  const heading = page.createElement('h1');
  const body = page.createElement('div');

  if (item.type === 'article') {
    heading.textContent = item.title;
    body.innerHTML = item.contentHtml;
  } else {
    element.classList.add('placeholder');
    heading.textContent = item.label;
    body.textContent = item.type === 'failure' ? item.reason : 'Cancelled';
  }
  element.append(heading, body);

  return element;
};

const receiveCancel =
  (
    popup: Popup,
    taskId: string,
    handler: () => void
  ): ((event: MessageEvent) => void) =>
  (event) => {
    const data = event.data as { type?: string; taskId?: string };
    if (
      event.source === popup &&
      data.type === 'web-printer:cancel' &&
      data.taskId === taskId
    ) {
      handler();
    }
  };

const summary = (page: Document, output: PrintDocument): HTMLElement => {
  const aside = page.createElement('aside');
  const value = output.summary;
  aside.textContent = `${value.succeeded} succeeded, ${value.failed} failed, ${value.cancelled} cancelled`;
  for (const failure of value.failures) {
    const line = page.createElement('p');
    line.textContent = `${failure.label}: ${failure.reason} (${failure.url})`;
    aside.append(line);
  }

  return aside;
};

export const openPreview = (
  open: OpenWindow = () => window.open('', '_blank'),
  taskId: string,
  title: string
): Preview | null => {
  const popup = open();
  if (!popup) {
    return null;
  }

  const page = popup.document;
  page.title = title;
  const root = page.createElement('main');
  const status = page.createElement('p');
  const cancel = action(page, 'cancel', 'Cancel');
  const nav = page.createElement('nav');
  const style = page.createElement('style');
  style.textContent = css;
  status.textContent = 'Preparing…';
  cancel.addEventListener('click', () => {
    popup.opener?.postMessage({ type: 'web-printer:cancel', taskId }, '*');
  });
  nav.append(status, cancel);
  page.head.append(style);
  page.body.replaceChildren(nav, root);

  let cancelled = false;
  window.addEventListener(
    'message',
    receiveCancel(popup, taskId, () => {
      cancelled = true;
    })
  );

  return {
    update: (progress) => {
      status.textContent = `${progress.state} ${progress.completed} / ${progress.total}`;
    },
    render: (output) => {
      page.title = output.title;
      const print = action(page, 'print', 'Print');
      const close = action(page, 'close', 'Close');
      print.addEventListener('click', () => popup.print());
      close.addEventListener('click', () => popup.close());
      nav.replaceChildren(print, close);
      root.replaceChildren(summary(page, output));
      root.append(...output.items.map((item) => renderItem(page, item)));
    },
    isCancelled: () => cancelled,
    isClosed: () => popup.closed,
  };
};
