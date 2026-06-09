import type { ExtractedPage } from './entity';
import type {
  ContentExtractorPort,
  LinkFinderPort,
  PageFetcherPort,
  PrintPort,
  ViewPort,
} from './port';

// ---------------------------------------------------------------------------
// Pure functions — HTML building (no side effects, no external dependencies)
// ---------------------------------------------------------------------------

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

const buildContentBlock = (params: { page: ExtractedPage; index: number }): string =>
  `<section class="page-section">
    <h1 class="page-title">${esc(params.page.title || `Page ${params.index + 1}`)}</h1>
    ${buildSourceUrl(params.page.url)}
    ${params.page.html}
  </section>`;

const buildContent = (pages: ExtractedPage[]): string =>
  `<main id="content">${pages.map((page, index) => buildContentBlock({ index, page })).join('\n')}</main>`;

export const buildHtml = (pages: ExtractedPage[], customCss?: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Merged Document - ${pages.length} pages</title>
<style>${customCss ?? DEFAULT_PRINT_CSS}</style>
</head>
<body>
  ${buildContent(pages)}
</body>
</html>`;

// ---------------------------------------------------------------------------
// Workflow — orchestrates IO through ports, pure logic inlined
// ---------------------------------------------------------------------------

export interface PrintWorkflowDeps {
  finder: LinkFinderPort;
  fetcher: PageFetcherPort;
  extractor: ContentExtractorPort;
  printer: PrintPort;
  view: ViewPort;
}

export const createPrintWorkflow = (deps: PrintWorkflowDeps) => {
  let lastSelector = '';

  const start = async (customCss: string): Promise<void> => {
    while (true) {
      const selector = await deps.view.promptSelector(lastSelector || undefined);
      if (selector === null) return;

      const links = deps.finder.findLinks(selector);
      if (links.length === 0) {
        deps.view.showToast('No matching links found');
        return;
      }

      const selected = await deps.view.selectLinks(links);
      if (selected === null) {
        lastSelector = selector;
        continue;
      }
      if (selected.length === 0) return;

      deps.view.showProgress({ done: 0, phase: 'Fetching pages...', total: selected.length });
      const results = await deps.fetcher.fetchPages(selected);
      if (deps.view.cancelled) {
        deps.view.removeProgress();
        return;
      }

      const okResults = results.filter((r) => r.ok);
      if (okResults.length === 0) {
        deps.view.removeProgress();
        deps.view.showToast('All pages failed to fetch');
        return;
      }

      deps.view.showProgress({
        done: 0,
        phase: 'Extracting content...',
        total: okResults.length,
      });
      const pages = deps.extractor.extractPages(okResults);
      if (deps.view.cancelled) {
        deps.view.removeProgress();
        return;
      }

      deps.view.showProgress({
        done: pages.length,
        phase: 'Generating HTML...',
        total: pages.length,
      });
      const html = buildHtml(pages, customCss);

      deps.view.showProgress({ done: 1, phase: 'Opening print window...', total: 1 });
      deps.view.removeProgress();
      await deps.printer.printHtml(html);

      return;
    }
  };

  return { start };
};
