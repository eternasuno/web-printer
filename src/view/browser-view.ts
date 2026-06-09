import type { ViewPort } from '../core/port';
import { promptSelector, promptSettings, selectLinks } from './dialog';
import { isCancelled, removeProgress, showProgress, showToast } from './progress';

export const createBrowserView = (): ViewPort => ({
  get cancelled() {
    return isCancelled();
  },
  promptSelector: (initialSelector?: string) => promptSelector(initialSelector),
  removeProgress,
  selectLinks,
  showProgress,
  showToast,
});

export { promptSettings };
