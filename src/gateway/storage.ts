declare function GM_getValue(key: string, defaultValue?: string): string;
declare function GM_setValue(key: string, value: string): void;

const STORAGE_KEY = 'wp-custom-css';

export const getCustomCss = (defaultCss: string): string =>
  GM_getValue(STORAGE_KEY, defaultCss);

export const setCustomCss = (css: string): void => {
  GM_setValue(STORAGE_KEY, css);
};

export const initCustomCss = (defaultCss: string): void => {
  if (!GM_getValue(STORAGE_KEY)) {
    GM_setValue(STORAGE_KEY, defaultCss);
  }
};