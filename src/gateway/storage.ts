import type { BatchConfig } from '../core/usecase';

declare function GM_getValue(key: string, defaultValue?: string): string;
declare function GM_setValue(key: string, value: string): void;

const CSS_KEY = 'wp-custom-css';
const BATCH_KEY = 'wp-batch-config';

export const getCustomCss = (defaultCss: string): string => GM_getValue(CSS_KEY, defaultCss);

export const setCustomCss = (css: string): void => {
  GM_setValue(CSS_KEY, css);
};

export const initCustomCss = (defaultCss: string): void => {
  if (!GM_getValue(CSS_KEY)) {
    GM_setValue(CSS_KEY, defaultCss);
  }
};

export const getBatchConfig = (defaults: BatchConfig): BatchConfig => {
  const raw = GM_getValue(BATCH_KEY, '');
  if (!raw) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(raw) as Partial<BatchConfig>) };
  } catch {
    return defaults;
  }
};

export const setBatchConfig = (config: BatchConfig): void => {
  GM_setValue(BATCH_KEY, JSON.stringify(config));
};

export const initBatchConfig = (defaults: BatchConfig): void => {
  if (!GM_getValue(BATCH_KEY)) setBatchConfig(defaults);
};
