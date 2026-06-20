import { createDomFinder } from './adapter/dom-finder';
import { createGmFetcher } from './adapter/gm-fetcher';
import { createReadabilityExtractor } from './adapter/readability-extractor';
import type { Article } from './core/entity';
import { DEFAULT_BATCH_CONFIG, extractArticlesStream, findLinks } from './core/usecase';
import { promptSelector, promptSettings, selectLinks } from './gateway/dialog';
import { registerMenu } from './gateway/menu';
import { buildHtml, DEFAULT_PRINT_CSS, openPreview } from './gateway/printer';
import { isCancelled, removeProgress, showProgress, showToast } from './gateway/progress';
import {
  getBatchConfig,
  getCustomCss,
  initBatchConfig,
  initCustomCss,
  setBatchConfig,
  setCustomCss,
} from './gateway/storage';
import { injectStyles } from './gateway/styles';

const start = async (): Promise<void> => {
  let lastSelector = '';

  while (true) {
    const result = await promptSelector({
      config: getBatchConfig(DEFAULT_BATCH_CONFIG),
      selector: lastSelector || undefined,
    });
    if (result === null) return;
    const { selector, config } = result;
    setBatchConfig(config);

    const links = findLinks(selector)(window.location.hostname)(createDomFinder());
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
    const articles: Article[] = [];
    for await (const article of extractArticlesStream(selected)(config)({ extractor, fetcher })) {
      if (isCancelled()) break;
      articles.push(article);
      showProgress({
        done: articles.length,
        phase: 'Processing pages...',
        total: selected.length,
      });
    }

    if (isCancelled()) {
      removeProgress();
      return;
    }
    if (articles.length === 0) {
      removeProgress();
      showToast('All pages failed to fetch');
      return;
    }

    const customCss = getCustomCss(DEFAULT_PRINT_CSS);
    const html = buildHtml({ articles, customCss });

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
  if (document.querySelector('meta[name="wp-preview"]')) return;
  injectStyles();
  initCustomCss(DEFAULT_PRINT_CSS);
  initBatchConfig(DEFAULT_BATCH_CONFIG);
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
