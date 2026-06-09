import type { PrintPort } from '../core/port';

const PRINT_DELAY = 500;
const POLL_INTERVAL = 500;
const MAX_WAIT = 60000;

const openWindow = (html: string): Window | null => {
  const win = window.open('', '_blank');
  if (!win) return null;
  win.document.write(html);
  win.document.close();
  return win;
};

const waitForPrint = (win: Window): Promise<void> =>
  new Promise((resolve) => {
    const timer = setInterval(() => {
      if (win.closed) {
        clearInterval(timer);
        resolve();
      }
    }, POLL_INTERVAL);
    setTimeout(() => {
      clearInterval(timer);
      resolve();
    }, MAX_WAIT);
  });

export const createWindowPrinter = (): PrintPort => ({
  printHtml: async (html: string): Promise<void> => {
    const win = openWindow(html);
    if (!win) return;
    await new Promise((r) => setTimeout(r, PRINT_DELAY));
    win.focus();
    win.print();
    await waitForPrint(win);
  },
});
