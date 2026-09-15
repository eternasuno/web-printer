import type { Post, PrintDocument } from '../entity';
import { button } from './dom';

type Popup = Pick<
  Window,
  | 'document'
  | 'closed'
  | 'close'
  | 'print'
  | 'postMessage'
  | 'opener'
  | 'addEventListener'
  | 'removeEventListener'
>;
type OpenWindow = () => Popup | null;

type PreviewOptions = {
  readonly taskId: string;
  readonly title: string;
  readonly onCancel: () => void;
  readonly open?: OpenWindow;
};

type PreviewProgress = {
  readonly completed: number;
  readonly total: number;
};

interface Preview {
  update(progress: PreviewProgress): void;
  render(document: PrintDocument): void;
}

const css = `
  html{scroll-behavior:smooth}
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

const renderPost = (page: Document, post: Post, index: number): HTMLElement => {
  const element = page.createElement('article');
  element.id = `post-${index}`;
  if (index > 0) {
    element.classList.add('break');
  }
  const heading = page.createElement('h1');
  const body = page.createElement('div');

  if (post.type === 'success') {
    heading.textContent = post.title;
    body.innerHTML = post.contentHtml;
  } else {
    element.classList.add('placeholder');
    heading.textContent = post.link.label;
    body.textContent = post.reason;
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

const renderOutput = (
  popup: Popup,
  nav: HTMLElement,
  root: HTMLElement,
  output: PrintDocument
): void => {
  const page = popup.document;
  page.title = output.title;
  const print = button(page, 'print', 'Print');
  const close = button(page, 'close', 'Close');
  print.addEventListener('click', () => popup.print());
  close.addEventListener('click', () => popup.close());
  nav.replaceChildren(print, close);
  root.replaceChildren(summary(page, output.posts));
  root.append(
    ...output.posts.map((post, index) => renderPost(page, post, index))
  );
};

const summary = (page: Document, posts: readonly Post[]): HTMLElement => {
  const aside = page.createElement('aside');
  const failures = posts.flatMap((post) =>
    post.type === 'failure' ? [post] : []
  );
  aside.textContent = `${posts.length - failures.length} succeeded, ${failures.length} failed`;
  const toc = page.createElement('ol');
  for (const [index, post] of posts.entries()) {
    const item = page.createElement('li');
    const anchor = page.createElement('a');
    anchor.href = `#post-${index}`;
    anchor.textContent = post.type === 'success' ? post.title : post.link.label;
    item.append(anchor);
    toc.append(item);
  }
  aside.append(toc);
  for (const failure of failures) {
    const line = page.createElement('p');
    line.textContent = `${failure.link.label}: ${failure.reason} (${failure.link.url})`;
    aside.append(line);
  }

  return aside;
};

const mount = (
  page: Document
): {
  root: HTMLElement;
  status: HTMLElement;
  cancel: HTMLButtonElement;
  nav: HTMLElement;
} => {
  const root = page.createElement('main');
  const status = page.createElement('p');
  const cancel = button(page, 'cancel', 'Cancel');
  const nav = page.createElement('nav');
  const style = page.createElement('style');
  style.textContent = css;
  status.textContent = 'Preparing…';
  nav.append(status, cancel);
  page.head.append(style);
  page.body.replaceChildren(nav, root);

  return { root, status, cancel, nav };
};

export const openPreview = ({
  open = () => window.open('', '_blank'),
  taskId,
  title,
  onCancel,
}: PreviewOptions): Preview | null => {
  const popup = open();
  if (!popup) {
    return null;
  }

  const page = popup.document;
  page.title = title;
  const { root, status, cancel, nav } = mount(page);
  let settled = false;
  const settle = (): boolean => {
    if (settled) {
      return false;
    }
    settled = true;
    window.removeEventListener('message', message);
    popup.removeEventListener('pagehide', onPageHide);

    return true;
  };
  const teardown = (): void => {
    if (settle()) {
      popup.close();
      onCancel();
    }
  };
  const message = receiveCancel(popup, taskId, teardown);
  const onPageHide = (): void => teardown();

  cancel.addEventListener('click', () => {
    popup.opener?.postMessage({ type: 'web-printer:cancel', taskId }, '*');
  });
  window.addEventListener('message', message);
  popup.addEventListener('pagehide', onPageHide);

  return {
    update: (progress) => {
      if (!settled) {
        status.textContent = `fetching ${progress.completed} / ${progress.total}`;
      }
    },
    render: (output) => {
      if (!settle()) {
        return;
      }
      renderOutput(popup, nav, root, output);
    },
  };
};
