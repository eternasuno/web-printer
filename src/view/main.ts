import { createDomFinder } from '../adapter/dom-finder';
import { createGmFetcher } from '../adapter/gm-fetcher';
import { createReadabilityExtractor } from '../adapter/readability-extractor';
import { createWindowPrinter } from '../adapter/window-printer';
import { createPrintWorkflow, DEFAULT_PRINT_CSS } from '../core/usecase';
import { createBrowserView, promptSettings } from './browser-view';
import { injectStyles } from './styles';

declare function GM_registerMenuCommand(name: string, callback: () => void): void;
declare function GM_getValue(key: string, defaultValue?: string): string;
declare function GM_setValue(key: string, value: string): void;

const STORAGE_KEY = 'wp-custom-css';

const init = (): void => {
  injectStyles();

  if (!GM_getValue(STORAGE_KEY)) {
    GM_setValue(STORAGE_KEY, DEFAULT_PRINT_CSS);
  }

  const view = createBrowserView();
  const workflow = createPrintWorkflow({
    extractor: createReadabilityExtractor(),
    fetcher: createGmFetcher(),
    finder: createDomFinder(),
    printer: createWindowPrinter(),
    view,
  });

  GM_registerMenuCommand('Web Printer', () => {
    const customCss = GM_getValue(STORAGE_KEY, DEFAULT_PRINT_CSS);
    void workflow.start(customCss);
  });

  GM_registerMenuCommand('Web Printer Settings', async () => {
    const currentCss = GM_getValue(STORAGE_KEY, DEFAULT_PRINT_CSS);
    const result = await promptSettings(currentCss);
    if (result !== null) {
      GM_setValue(STORAGE_KEY, result);
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
