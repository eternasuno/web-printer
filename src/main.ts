import { findLinks } from './adapter/dom-finder';
import { fetchPage } from './adapter/gm-fetcher';
import { extractArticle } from './adapter/readability-extractor';
import { discoverLinks, runBatch } from './core/usecase';
import { showPreview } from './gateway/printer';
import {
  showLinksDialog,
  showPreviewButton,
  showProgress,
  showToast,
  showXPathDialog,
} from './gateway/ui';

export type AppDependencies = {
  showXPathDialog: typeof showXPathDialog;
  showLinksDialog: typeof showLinksDialog;
  showProgress: typeof showProgress;
  showToast: typeof showToast;
  showPreview: typeof showPreview;
  showPreviewButton: typeof showPreviewButton;
  discoverLinks: typeof discoverLinks;
  runBatch: typeof runBatch;
  findLinks: typeof findLinks;
  fetchPage: typeof fetchPage;
  extractArticle: typeof extractArticle;
  location: Location;
  window: Window;
};

const defaultDependencies = (): AppDependencies => ({
  showXPathDialog,
  showLinksDialog,
  showProgress,
  showToast,
  showPreview,
  showPreviewButton,
  discoverLinks,
  runBatch,
  findLinks,
  fetchPage,
  extractArticle,
  location,
  window,
});

export const createApp = (provided: Partial<AppDependencies> = {}) => {
  const deps = { ...defaultDependencies(), ...provided };
  let active = false;

  const start = async (): Promise<void> => {
    if (active) {
      deps.showToast('Web Printer is already running');
      return;
    }
    active = true;
    const controller = new AbortController();
    let blank: Window | null = null;
    let progress: ReturnType<typeof showProgress> | undefined;
    try {
      let xpath: string | undefined;
      let errorMessage: string | undefined;
      let discovered!: ReturnType<typeof discoverLinks>;
      let selected!: import('./core/entity').SourceLink[];
      while (true) {
        const submitted = await deps.showXPathDialog({ initial: xpath, error: errorMessage });
        xpath = submitted?.trim() || undefined;
        if (!xpath) return;
        try {
          discovered = deps.discoverLinks(xpath, deps.location.href, deps.findLinks);
          if (!discovered.length) throw new Error('No links found for this XPath');
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : 'Invalid XPath';
          continue;
        }
        if (discovered.truncated) deps.showToast('Only the first 200 links are shown');
        const selection = await deps.showLinksDialog(discovered);
        if (selection.kind === 'back') {
          errorMessage = undefined;
          continue;
        }
        if (selection.kind === 'cancel' || !selection.links.length) return;
        selected = selection.links;
        break;
      }
      blank = deps.window.open('', '_blank');
      if (blank) blank.opener = null;
      progress = deps.showProgress(selected.length, controller);
      const result = await deps.runBatch(
        selected.map((link) => link.url),
        async (url, signal) => {
          const response = await deps.fetchPage(url, signal);
          const final = new URL(response.finalUrl);
          if (response.status < 200 || response.status >= 300)
            throw Object.assign(new Error(`HTTP ${response.status}`), { code: 'http-error' });
          if (final.origin !== deps.location.origin)
            throw Object.assign(new Error('Cross-origin redirect'), {
              code: 'cross-origin-redirect',
            });
          const contentType = response.contentType.trim().toLowerCase();
          const looksLikeHtml = /^\uFEFF?\s*(?:<!doctype\s+html\b|<html(?:\s|>))/i.test(
            response.responseText,
          );
          if (contentType !== 'text/html' && !(contentType === '' && looksLikeHtml))
            throw Object.assign(new Error('Unsupported content type'), {
              code: 'unsupported-content-type',
            });
          return {
            ...deps.extractArticle(
              response.responseText,
              final.href,
              selected.findIndex((link) => link.url === url) + 1,
            ),
            url,
          };
        },
        controller.signal,
        progress?.update,
      );
      if (!result.articles.length) {
        blank?.close();
        blank = null;
        deps.showToast(
          `All pages failed\n${result.failures.map((failure) => `${failure.url}: ${failure.message}`).join('\n')}`,
        );
        return;
      }
      if (blank) deps.showPreview(blank, result);
      else deps.showPreviewButton(result);
      blank = null;
    } catch (error) {
      if ((error as { code?: string }).code === 'cancelled') deps.showToast('Cancelled');
      else deps.showToast(error instanceof Error ? error.message : 'Internal error');
    } finally {
      progress?.close();
      blank?.close();
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
if (typeof document !== 'undefined' && typeof GM_registerMenuCommand !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}
