import type { Article } from '../core/entity';

export const DEFAULT_PRINT_CSS = `
* { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", sans-serif;
  font-size: 12pt;
  line-height: 1.8;
  color: #1a1a1a;
  max-width: 210mm;
  margin: 0 auto;
  padding: 20px;
}
.page-section { margin-bottom: 32px; }
.page-title { font-size: 16pt; border-bottom: 2px solid #333; padding-bottom: 8px; margin-top: 0; }
.source-url { font-size: 9pt; color: #666; }
.source-url a { color: #0366d6; }
pre {
  background: #f6f8fa;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  font-size: 10pt;
  line-height: 1.45;
}
code { background: #f6f8fa; padding: 2px 6px; border-radius: 4px; font-size: 10pt; }
pre code { background: none; padding: 0; }
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; width: 100%; margin: 16px 0; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #dfe2e5; padding: 8px 12px; text-align: left; overflow-wrap: break-word; word-break: break-word; }
th { background: #f6f8fa; }
blockquote {
  margin: 16px 0;
  padding: 8px 16px;
  border-left: 4px solid #dfe2e5;
  color: #6a737d;
}
@media print {
  @page { margin: 1.5cm; }
  body { padding: 0; font-size: 11pt; }
  .page-section { page-break-before: always; page-break-inside: auto; }
  .page-section:first-child { page-break-before: avoid; }
  table { table-layout: fixed; }
  h2, h3 { page-break-after: avoid; }
  img, figure, blockquote { break-inside: avoid; }
  pre { page-break-inside: avoid; white-space: pre-wrap; word-break: break-all; }
  .source-url { display: none; }
  a { color: inherit; text-decoration: none; }
}
`;

const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const buildSourceUrl = (url: string): string =>
  url ? `<p class="source-url">Source: <a href="${esc(url)}">${esc(url)}</a></p>` : '';

const buildContentBlock = (article: Article, index: number): string =>
  `<section class="page-section">
    <h1 class="page-title">${esc(article.title || `Page ${index + 1}`)}</h1>
    ${buildSourceUrl(article.url)}
    ${article.content}
  </section>`;

export const buildHtml = (articles: Article[], customCss?: string): string => {
  const content = articles.map((article, index) => buildContentBlock(article, index)).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Merged Document - ${articles.length} pages</title>
<style>${customCss ?? DEFAULT_PRINT_CSS}</style>
</head>
<body>
  <main id="content">${content}</main>
</body>
</html>`;
};

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

export const printHtml = async (html: string): Promise<void> => {
  const win = openWindow(html);
  if (!win) return;
  await new Promise((r) => setTimeout(r, PRINT_DELAY));
  win.focus();
  win.print();
  await waitForPrint(win);
};