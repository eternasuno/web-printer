import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExtractedPage, FetchResult, LinkInfo } from '../../src/core/entity';
import type {
  ContentExtractorPort,
  LinkFinderPort,
  PageFetcherPort,
  PrintPort,
  ViewPort,
} from '../../src/core/port';
import { buildHtml, createPrintWorkflow } from '../../src/core/usecase';

describe('buildHtml', () => {
  it('generates HTML with correct page sections', () => {
    const pages: ExtractedPage[] = [
      { html: '<p>A</p>', title: 'Page A', url: 'https://example.com/a' },
      { html: '<p>B</p>', title: 'Page B', url: 'https://example.com/b' },
    ];
    const html = buildHtml(pages);
    expect(html).toContain('Page A');
    expect(html).toContain('Page B');
    expect(html).toContain('page-section');
  });

  it('includes print styles', () => {
    const html = buildHtml([{ html: '<p>A</p>', title: 'A', url: 'https://example.com/a' }]);
    expect(html).toContain('@media print');
    expect(html).toContain('page-break-before');
  });

  it('includes source URL', () => {
    const html = buildHtml([{ html: '<p>A</p>', title: 'A', url: 'https://example.com/a' }]);
    expect(html).toContain('Source');
    expect(html).toContain('https://example.com/a');
  });

  it('escapes special characters in title', () => {
    const html = buildHtml([
      { html: '<p>A</p>', title: 'A & B < C > "D"', url: 'https://example.com/a' },
    ]);
    expect(html).toContain('A &amp; B &lt; C &gt; &quot;D&quot;');
  });

  it('handles empty page array', () => {
    const html = buildHtml([]);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<main id="content"></main>');
  });

  it('uses URL as fallback when title is empty', () => {
    const html = buildHtml([
      { html: '<p>No title</p>', title: '', url: 'https://example.com/no-title' },
    ]);
    expect(html).toContain('https://example.com/no-title');
  });
});

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

const createMockFinder = (overrides?: Partial<LinkFinderPort>): LinkFinderPort => ({
  findLinks: vi.fn<LinkFinderPort['findLinks']>().mockReturnValue([]),
  ...overrides,
});

const createMockFetcher = (overrides?: Partial<PageFetcherPort>): PageFetcherPort => ({
  fetchPages: vi.fn<PageFetcherPort['fetchPages']>().mockResolvedValue([]),
  ...overrides,
});

const createMockExtractor = (
  overrides?: Partial<ContentExtractorPort>
): ContentExtractorPort => ({
  extractPages: vi.fn<ContentExtractorPort['extractPages']>().mockReturnValue([]),
  ...overrides,
});

const createMockPrinter = (overrides?: Partial<PrintPort>): PrintPort => ({
  printHtml: vi.fn<PrintPort['printHtml']>().mockResolvedValue(undefined),
  ...overrides,
});

const createMockView = (overrides?: Partial<ViewPort>): ViewPort => ({
  cancelled: false,
  promptSelector: vi.fn<ViewPort['promptSelector']>().mockResolvedValue(null),
  removeProgress: vi.fn<ViewPort['removeProgress']>(),
  selectLinks: vi.fn<ViewPort['selectLinks']>().mockResolvedValue([]),
  showProgress: vi.fn<ViewPort['showProgress']>(),
  showToast: vi.fn<ViewPort['showToast']>(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Default mock data
// ---------------------------------------------------------------------------

const mockLinks: LinkInfo[] = [
  { text: 'Introduction', url: '/docs/intro' },
  { text: 'Guide', url: '/docs/guide' },
];

const mockSelected: string[] = ['/docs/intro', '/docs/guide'];

const mockFetchResults: FetchResult[] = [
  { html: '<h1>Intro</h1>', ok: true, url: '/docs/intro' },
  { html: '<h1>Guide</h1>', ok: true, url: '/docs/guide' },
];

const mockExtractedPages: ExtractedPage[] = [
  { html: '<h1>Intro</h1>', title: 'Introduction', url: '/docs/intro' },
  { html: '<h1>Guide</h1>', title: 'Guide', url: '/docs/guide' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createPrintWorkflow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Happy path ──────────────────────────────────────────────────────────
  it('completes the full happy-path workflow', async () => {
    const view = createMockView({
      promptSelector: vi.fn().mockResolvedValue('nav a'),
      selectLinks: vi.fn().mockResolvedValue(mockSelected),
    });
    const finder = createMockFinder({
      findLinks: vi.fn().mockReturnValue(mockLinks),
    });
    const fetcher = createMockFetcher({
      fetchPages: vi.fn().mockResolvedValue(mockFetchResults),
    });
    const extractor = createMockExtractor({
      extractPages: vi.fn().mockReturnValue(mockExtractedPages),
    });
    const printer = createMockPrinter();

    const { start } = createPrintWorkflow({ extractor, fetcher, finder, printer, view });
    await start('');

    // 1. prompt for selector
    expect(view.promptSelector).toHaveBeenCalledOnce();
    // 2. find links
    expect(finder.findLinks).toHaveBeenCalledWith('nav a');
    // 3. let user select
    expect(view.selectLinks).toHaveBeenCalledWith(mockLinks);
    // 4. show progress – fetching
    expect(view.showProgress).toHaveBeenCalledWith({
      done: 0,
      phase: 'Fetching pages...',
      total: 2,
    });
    // 5. fetch pages
    expect(fetcher.fetchPages).toHaveBeenCalledWith(mockSelected);
    // 6. show progress – extracting
    expect(view.showProgress).toHaveBeenCalledWith({
      done: 0,
      phase: 'Extracting content...',
      total: 2,
    });
    // 7. extract content
    expect(extractor.extractPages).toHaveBeenCalledWith(mockFetchResults);
    // 8. show progress – building
    expect(view.showProgress).toHaveBeenCalledWith({
      done: 2,
      phase: 'Generating HTML...',
      total: 2,
    });
    // 9. print (buildHtml is pure, called inline)
    expect(printer.printHtml).toHaveBeenCalled();
    // 10. show progress – printing
    expect(view.showProgress).toHaveBeenCalledWith({
      done: 1,
      phase: 'Opening print window...',
      total: 1,
    });
    // 11. cleanup
    expect(view.removeProgress).toHaveBeenCalledOnce();
  });

  // ── Empty selector (user cancels) ───────────────────────────────────────
  it('exits early when selector is empty', async () => {
    const view = createMockView({
      promptSelector: vi.fn().mockResolvedValue(null),
    });
    const finder = createMockFinder();
    const { start } = createPrintWorkflow({
      extractor: createMockExtractor(),
      fetcher: createMockFetcher(),
      finder,
      printer: createMockPrinter(),
      view,
    });
    await start('');

    expect(view.promptSelector).toHaveBeenCalledOnce();
    expect(finder.findLinks).not.toHaveBeenCalled();
    expect(view.showToast).not.toHaveBeenCalled();
    expect(view.removeProgress).not.toHaveBeenCalled();
  });

  // ── No links found ──────────────────────────────────────────────────────
  it('shows toast and exits when no links match the selector', async () => {
    const view = createMockView({
      promptSelector: vi.fn().mockResolvedValue('nav a'),
    });
    const finder = createMockFinder({
      findLinks: vi.fn().mockReturnValue([]),
    });

    const { start } = createPrintWorkflow({
      extractor: createMockExtractor(),
      fetcher: createMockFetcher(),
      finder,
      printer: createMockPrinter(),
      view,
    });
    await start('');

    expect(view.promptSelector).toHaveBeenCalledOnce();
    expect(finder.findLinks).toHaveBeenCalledWith('nav a');
    expect(view.showToast).toHaveBeenCalledWith('No matching links found');
    expect(view.selectLinks).not.toHaveBeenCalled();
    expect(view.removeProgress).not.toHaveBeenCalled();
  });

  // ── No links selected (user cancels selection) ──────────────────────────
  it('exits early when user cancels selection (close)', async () => {
    const view = createMockView({
      promptSelector: vi.fn().mockResolvedValue('nav a'),
      selectLinks: vi.fn().mockResolvedValue([]),
    });
    const finder = createMockFinder({
      findLinks: vi.fn().mockReturnValue(mockLinks),
    });
    const fetcher = createMockFetcher();

    const { start } = createPrintWorkflow({
      extractor: createMockExtractor(),
      fetcher,
      finder,
      printer: createMockPrinter(),
      view,
    });
    await start('');

    expect(view.promptSelector).toHaveBeenCalledOnce();
    expect(finder.findLinks).toHaveBeenCalledWith('nav a');
    expect(view.selectLinks).toHaveBeenCalledWith(mockLinks);
    expect(fetcher.fetchPages).not.toHaveBeenCalled();
    expect(view.showToast).not.toHaveBeenCalled();
    expect(view.removeProgress).not.toHaveBeenCalled();
  });

  // ── Back button returns to selector ────────────────────────────────────
  it('returns to selector when user clicks back', async () => {
    const view = createMockView({
      promptSelector: vi.fn().mockResolvedValueOnce('nav a').mockResolvedValueOnce(null),
      selectLinks: vi.fn().mockResolvedValueOnce(null),
    });
    const finder = createMockFinder({
      findLinks: vi.fn().mockReturnValue(mockLinks),
    });

    const { start } = createPrintWorkflow({
      extractor: createMockExtractor(),
      fetcher: createMockFetcher(),
      finder,
      printer: createMockPrinter(),
      view,
    });
    await start('');

    // First call: selector → links → back (null) → second call: selector → cancel (null)
    expect(view.promptSelector).toHaveBeenCalledTimes(2);
    expect(view.selectLinks).toHaveBeenCalledOnce();
    expect(finder.findLinks).toHaveBeenCalledWith('nav a');
  });

  // ── All pages fail to fetch ─────────────────────────────────────────────
  it('shows error toast when all fetches fail', async () => {
    const view = createMockView({
      promptSelector: vi.fn().mockResolvedValue('nav a'),
      selectLinks: vi.fn().mockResolvedValue(mockSelected),
    });
    const finder = createMockFinder({
      findLinks: vi.fn().mockReturnValue(mockLinks),
    });
    const failedResults: FetchResult[] = [
      { error: 'timeout', html: '', ok: false, url: '/docs/intro' },
      { error: 'not found', html: '', ok: false, url: '/docs/guide' },
    ];
    const fetcher = createMockFetcher({
      fetchPages: vi.fn().mockResolvedValue(failedResults),
    });
    const extractor = createMockExtractor();

    const { start } = createPrintWorkflow({
      extractor,
      fetcher,
      finder,
      printer: createMockPrinter(),
      view,
    });
    await start('');

    expect(fetcher.fetchPages).toHaveBeenCalledWith(mockSelected);
    expect(view.showToast).toHaveBeenCalledWith('All pages failed to fetch');
    expect(extractor.extractPages).not.toHaveBeenCalled();
    expect(view.removeProgress).toHaveBeenCalledOnce();
  });
});
