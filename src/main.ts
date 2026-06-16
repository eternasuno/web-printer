import { createDomFinder } from './adapter/dom-finder';
import { createGmFetcher } from './adapter/gm-fetcher';
import { createReadabilityExtractor } from './adapter/readability-extractor';
import { extractArticle, findLinks } from './core/usecase';
import { promptSelector, promptSettings, selectLinks } from './gateway/dialog';
import { registerMenu } from './gateway/menu';
import { buildHtml, DEFAULT_PRINT_CSS, openPreview } from './gateway/printer';
import { isCancelled, removeProgress, showProgress, showToast } from './gateway/progress';
import { getCustomCss, initCustomCss, setCustomCss } from './gateway/storage';
import { injectStyles } from './gateway/styles';

const start = async (): Promise<void> => {
  let lastSelector = '';

  while (true) {
    const selector = await promptSelector(lastSelector || undefined);
    if (selector === null) return;

    const links = findLinks(selector)(createDomFinder());
    if (links.length === 0) {
      showToast('No matching links found');
      return;
    }

    const selected = await selectLinks(links);
    if (selected === null) {
      lastSelector = selector;
      continue;
    }
    if (selected.length === 0) return;

    const fetcher = createGmFetcher();
    const extractor = createReadabilityExtractor();

    showProgress({ done: 0, phase: 'Processing pages...', total: selected.length });
    const articles = [];

    for (const url of selected) {
      if (isCancelled()) {
        removeProgress();
        return;
      }
      try {
        const article = await extractArticle(url)({ extractor, fetcher });
        articles.push(article);
        showProgress({
          done: articles.length,
          phase: 'Processing pages...',
          total: selected.length,
        });
      } catch {
        // Skip failed pages
      }
    }

    if (articles.length === 0) {
      removeProgress();
      showToast('All pages failed to fetch');
      return;
    }

    const customCss = getCustomCss(DEFAULT_PRINT_CSS);
    const html = buildHtml(articles, customCss);

    removeProgress();
    const win = openPreview(html);
    if (!win) showToast('Popup blocked — please allow popups for this site');
    return;
  }
};

const openSettings = async (): Promise<void> => {
  const currentCss = getCustomCss(DEFAULT_PRINT_CSS);
  const result = await promptSettings(currentCss);
  if (result !== null) {
    setCustomCss(result);
  }
};

const init = (): void => {
  injectStyles();
  initCustomCss(DEFAULT_PRINT_CSS);
  registerMenu({
    onSettings: () => void openSettings(),
    onStart: () => void start(),
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
