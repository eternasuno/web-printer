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
  const css = customCss ?? DEFAULT_PRINT_CSS;
  const escapedCss = esc(css);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Merged Document - ${articles.length} pages</title>
<style id="wp-preview-style">${css}</style>
<style>
/* Preview UI styles - hidden during print */
.wp-toolbar { position: fixed; top: 12px; right: 12px; z-index: 2147483646; display: flex; gap: 4px; padding: 4px; background: rgba(255,255,255,0.85); backdrop-filter: blur(6px); border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
.wp-toolbar button { width: 36px; height: 36px; border: none; background: none; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; border-radius: 6px; }
.wp-toolbar button:hover { background: rgba(0,0,0,0.08); }
.wp-overlay { display: none; position: fixed; inset: 0; z-index: 2147483646; background: rgba(0,0,0,0.4); }
.wp-overlay.active { display: flex; align-items: center; justify-content: center; }
.wp-settings { background: #fff; border-radius: 12px; padding: 24px; width: 90%; max-width: 720px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
.wp-settings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.wp-settings-header h2 { margin: 0; font-size: 16pt; }
.wp-settings-close { width: 32px; height: 32px; border: none; background: none; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; border-radius: 6px; }
.wp-settings-close:hover { background: rgba(0,0,0,0.08); }
.wp-settings textarea { width: 100%; height: 50vh; min-height: 200px; font-family: monospace; font-size: 10pt; border: 1px solid #dfe2e5; border-radius: 6px; padding: 12px; resize: vertical; }
.wp-settings textarea:focus { outline: 2px solid #0366d6; border-color: transparent; }
.wp-apply { margin-top: 12px; padding: 8px 24px; border: none; background: #0366d6; color: #fff; border-radius: 6px; cursor: pointer; font-size: 11pt; align-self: flex-end; }
.wp-apply:hover { background: #0257b5; }
.wp-apply.applied { background: #28a745; }
@media print { .wp-toolbar, .wp-overlay { display: none !important; } }
</style>
</head>
<body>
  <div class="wp-toolbar">
    <button id="wp-print" type="button" title="Print" aria-label="Print">🖨️</button>
    <button id="wp-settings" type="button" title="Settings" aria-label="Settings">⚙️</button>
  </div>
  <div class="wp-overlay" id="wp-overlay">
    <div class="wp-settings">
      <div class="wp-settings-header">
        <h2>Settings</h2>
        <button class="wp-settings-close" id="wp-settings-close" type="button" aria-label="Close">✕</button>
      </div>
      <textarea id="wp-css-editor">${escapedCss}</textarea>
      <button class="wp-apply" id="wp-apply" type="button">Apply</button>
    </div>
  </div>
  <main id="content">${content}</main>
</body>
</html>`;
};

export const openPreview = (html: string): Window | null => {
  const win = window.open('', '_blank');
  if (!win) return null;
  win.document.write(html);
  win.document.close();

  const doc = win.document;
  const style = doc.getElementById('wp-preview-style') as HTMLStyleElement | null;
  const editor = doc.getElementById('wp-css-editor') as HTMLTextAreaElement | null;
  const overlay = doc.getElementById('wp-overlay') as HTMLDivElement | null;
  const applyBtn = doc.getElementById('wp-apply') as HTMLButtonElement | null;

  doc.getElementById('wp-print')?.addEventListener('click', () => {
    win.print();
  });
  doc.getElementById('wp-settings')?.addEventListener('click', () => {
    overlay?.classList.add('active');
    editor?.focus();
  });
  doc.getElementById('wp-settings-close')?.addEventListener('click', () => {
    overlay?.classList.remove('active');
  });
  overlay?.addEventListener('click', (e: Event) => {
    if (e.target === overlay) overlay.classList.remove('active');
  });
  doc.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') overlay?.classList.remove('active');
  });

  let applyTimer: ReturnType<typeof setTimeout>;
  applyBtn?.addEventListener('click', () => {
    if (style && editor) style.textContent = editor.value;
    if (applyBtn) {
      applyBtn.textContent = 'Applied';
      applyBtn.classList.add('applied');
      clearTimeout(applyTimer);
      applyTimer = setTimeout(() => {
        applyBtn.textContent = 'Apply';
        applyBtn.classList.remove('applied');
      }, 1500);
    }
  });

  return win;
};
