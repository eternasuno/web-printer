import { fetchPage } from './adapter/gm-fetcher';
import type { DiscoverResult } from './adapter/links';
import { discoverLinks } from './adapter/links';
import { extractArticle } from './adapter/readability-extractor';
import type { Article, Failure, FailureCode, SourceLink } from './core/entity';
import { runBatch } from './core/usecase';
import { showPreview } from './gateway/printer';
import type { LinksDialogResult, XPathOptions } from './gateway/ui';
import {
  showLinksDialog,
  showPreviewButton,
  showProgress,
  showToast,
  showXPathDialog,
} from './gateway/ui';

const httpStatusMin = 200;
const httpStatusMax = 300;
const truncatedNotice = 'Only the first 200 links are shown';
const htmlSniff = /^\uFEFF?\s*(?:<!doctype\s+html\b|<html(?:\s|>))/i;

const defaults = {
  showXPathDialog,
  showLinksDialog,
  showProgress,
  showToast,
  showPreview,
  showPreviewButton,
  discoverLinks,
  runBatch,
  fetchPage,
  extractArticle,
  document: document as Document,
  location: location as Location,
  window: window as Window,
};

type Deps = typeof defaults;

const codedError = (message: string, code: FailureCode): Error =>
  Object.assign(new Error(message), { code });

const acceptsHtml = (contentType: string, text: string): boolean => {
  const type = contentType.trim().toLowerCase();
  return type === 'text/html' || (type === '' && htmlSniff.test(text));
};

const pageLoader =
  (deps: Deps, urls: string[]) =>
  async (url: string, signal: AbortSignal): Promise<Article> => {
    const response = await deps.fetchPage(url, signal);
    const final = new URL(response.finalUrl);
    if (response.status < httpStatusMin || response.status >= httpStatusMax)
      throw codedError(`HTTP ${response.status}`, 'http-error');
    if (final.origin !== deps.location.origin)
      throw codedError('Cross-origin redirect', 'cross-origin-redirect');
    if (!acceptsHtml(response.contentType, response.responseText))
      throw codedError('Unsupported content type', 'unsupported-content-type');
    return deps.extractArticle(
      response.responseText,
      final.href,
      urls.indexOf(url) + 1
    );
  };

const noticeFor = (error: unknown): string => {
  if ((error as { code?: string }).code === 'cancelled') return 'Cancelled';
  return error instanceof Error ? error.message : 'Internal error';
};

const failureNotice = (failures: Failure[]): string =>
  `All pages failed\n${failures.map((item) => `${item.url}: ${item.message}`).join('\n')}`;

type Discovery = { links: DiscoverResult } | { error: string };

const discover = (deps: Deps, xpath: string): Discovery => {
  try {
    const links = deps.discoverLinks(xpath, deps.location.href, deps.document);
    if (!links.length) throw new Error('No links found for this XPath');
    return { links };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid XPath' };
  }
};

type Choice =
  | { kind: 'back' }
  | { kind: 'exit' }
  | { kind: 'picked'; links: SourceLink[] };

const pick = async (deps: Deps, links: DiscoverResult): Promise<Choice> => {
  const selection: LinksDialogResult = await deps.showLinksDialog(links);
  if (selection.kind === 'back') return { kind: 'back' };
  if (selection.kind !== 'selected' || !selection.links.length)
    return { kind: 'exit' };
  return { kind: 'picked', links: selection.links };
};

const askForLinks = async (
  deps: Deps,
  initial: string | undefined
): Promise<{ xpath: string; links: DiscoverResult } | undefined> => {
  let options: XPathOptions = { initial };
  while (true) {
    const xpath = (await deps.showXPathDialog(options))?.trim();
    if (!xpath) return undefined;
    const found = discover(deps, xpath);
    if ('error' in found) {
      options = { initial: xpath, error: found.error };
      continue;
    }
    if (found.links.truncated) deps.showToast(truncatedNotice);
    return { xpath, links: found.links };
  }
};

const chooseLinks = async (deps: Deps): Promise<SourceLink[] | undefined> => {
  let initial: string | undefined;
  while (true) {
    const asked = await askForLinks(deps, initial);
    if (!asked) return undefined;
    initial = asked.xpath;
    const choice = await pick(deps, asked.links);
    if (choice.kind === 'back') continue;
    return choice.kind === 'picked' ? choice.links : undefined;
  }
};

const runSession = async (deps: Deps): Promise<void> => {
  const controller = new AbortController();
  let blank: Window | null = null;
  let progress: ReturnType<typeof deps.showProgress> | undefined;
  try {
    const selected = await chooseLinks(deps);
    if (!selected) return;
    blank = deps.window.open('', '_blank');
    if (blank) blank.opener = null;
    progress = deps.showProgress(selected.length, controller);
    const urls = selected.map((link) => link.url);
    const result = await deps.runBatch(
      urls,
      pageLoader(deps, urls),
      controller.signal,
      progress.update
    );
    if (!result.articles.length) {
      blank?.close();
      blank = null;
      deps.showToast(failureNotice(result.failures));
      return;
    }
    if (blank) deps.showPreview(blank, result);
    else deps.showPreviewButton(result);
    blank = null;
  } catch (error) {
    deps.showToast(noticeFor(error));
  } finally {
    progress?.close();
    blank?.close();
  }
};

export const createApp = (
  provided: Partial<typeof defaults> = {}
): { start: () => Promise<void> } => {
  const deps = { ...defaults, ...provided };
  let active = false;
  const start = async (): Promise<void> => {
    if (active) {
      deps.showToast('Web Printer is already running');
      return;
    }
    active = true;
    try {
      await runSession(deps);
    } finally {
      active = false;
    }
  };
  return { start };
};

export const start = createApp().start;

const init = (): void => {
  if (
    !document.querySelector('[data-web-printer-preview]') &&
    typeof GM_registerMenuCommand === 'function'
  )
    GM_registerMenuCommand('Web Printer', () => void start());
};
if (
  typeof document !== 'undefined' &&
  typeof GM_registerMenuCommand !== 'undefined'
) {
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else init();
}
