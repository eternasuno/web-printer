import { createDomFinder } from './adapter/dom-finder';
import { createGmFetcher } from './adapter/gm-fetcher';
import { createReadabilityExtractor } from './adapter/readability-extractor';
import { findLinks, extractArticle } from './core/usecase';
import { promptSelector, promptSettings, selectLinks } from './gateway/dialog';
import { buildHtml, printHtml, DEFAULT_PRINT_CSS } from './gateway/printer';
import { registerMenu } from './gateway/menu';
import { injectStyles } from './gateway/styles';
import { showProgress, removeProgress, showToast, isCancelled } from './gateway/progress';
import { getCustomCss, initCustomCss, setCustomCss } from './gateway/storage';

const start = async (): Promise<void> => {
  let lastSelector = '';

  while (true) {
    const selector = await promptSelector(lastSelector || undefined);
    if (selector === null) return;

    const links = findLinks(createDomFinder(), selector);
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
        const article = await extractArticle(fetcher, extractor, url);
        articles.push(article);
        showProgress({ done: articles.length, phase: 'Processing pages...', total: selected.length });
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

    showProgress({ done: 1, phase: 'Opening print window...', total: 1 });
    removeProgress();
    await printHtml(html);
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
    onStart: () => void start(),
    onSettings: () => void openSettings(),
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}