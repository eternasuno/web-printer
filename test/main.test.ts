import { describe, expect, it, vi } from 'vitest';
import type { SourceLink } from '../src/core/entity';
import type { DiscoverResult } from '../src/core/usecase';
import { createApp } from '../src/main';

const location = new URL('https://docs.test/start') as unknown as Location;
const target = { close: vi.fn() } as unknown as Window;
const links = (items: SourceLink[]): DiscoverResult => Object.assign(items, { truncated: false });

const dependencies = () => ({
  showXPathDialog: vi.fn(() => new Promise<string | null>(() => undefined)),
  showLinksDialog: vi.fn(),
  showProgress: vi.fn(() => ({ update: vi.fn(), close: vi.fn() })),
  showToast: vi.fn(),
  showPreview: vi.fn(),
  showPreviewButton: vi.fn(),
  discoverLinks: vi.fn(() => links([])),
  runBatch: vi.fn(),
  findLinks: vi.fn(),
  fetchPage: vi.fn(),
  extractArticle: vi.fn(),
  location,
  window: { open: vi.fn(() => target) } as unknown as Window,
});

describe('main app orchestration', () => {
  it('prevents duplicate starts with a notification', async () => {
    const deps = dependencies();
    let resolveXPath!: (value: string | null) => void;
    deps.showXPathDialog.mockImplementation(
      () => new Promise<string | null>((resolve) => (resolveXPath = resolve)),
    );
    const app = createApp(deps);
    const first = app.start();
    await app.start();
    expect(deps.showToast).toHaveBeenCalledWith('Web Printer is already running');
    expect(deps.showXPathDialog).toHaveBeenCalledTimes(1);
    resolveXPath(null);
    await first;
  });

  it('reopens XPath after invalid and zero-result discovery, preserving input', async () => {
    const deps = dependencies();
    deps.showXPathDialog
      .mockResolvedValueOnce('//bad')
      .mockResolvedValueOnce('//bad')
      .mockResolvedValueOnce('//links');
    deps.discoverLinks
      .mockImplementationOnce(() => {
        throw new Error('Invalid XPath');
      })
      .mockImplementationOnce(() => links([]))
      .mockImplementationOnce(() =>
        links([{ text: 'Page', url: 'https://docs.test/page', selected: true }]),
      );
    deps.showLinksDialog.mockResolvedValue({ kind: 'cancel' });
    await createApp(deps).start();
    expect(deps.showXPathDialog).toHaveBeenNthCalledWith(2, {
      initial: '//bad',
      error: 'Invalid XPath',
    });
    expect(deps.showXPathDialog).toHaveBeenNthCalledWith(3, {
      initial: '//bad',
      error: 'No links found for this XPath',
    });
  });

  it('supports Back and cancel without opening a popup or leaking progress', async () => {
    const deps = dependencies();
    deps.showXPathDialog.mockResolvedValueOnce('//links').mockResolvedValueOnce(null);
    deps.discoverLinks.mockReturnValue(
      Object.assign([{ text: 'Page', url: 'https://docs.test/page', selected: true }], {
        truncated: false,
      }),
    );
    deps.showLinksDialog.mockResolvedValueOnce({ kind: 'back' });
    await createApp(deps).start();
    expect(deps.window.open).not.toHaveBeenCalled();
    expect(deps.showProgress).not.toHaveBeenCalled();
    expect(deps.showXPathDialog).toHaveBeenCalledTimes(2);
  });

  it('does not extract a response without HTML content type unless it sniffs as HTML', async () => {
    const deps = dependencies();
    deps.showXPathDialog.mockResolvedValue('//links');
    deps.discoverLinks.mockReturnValue(
      Object.assign([{ text: 'Page', url: 'https://docs.test/page', selected: true }], {
        truncated: false,
      }),
    );
    deps.showLinksDialog.mockResolvedValue({
      kind: 'selected',
      links: [{ text: 'Page', url: 'https://docs.test/page', selected: true }],
    });
    deps.runBatch.mockImplementation(async (_urls, fetch) => {
      await expect(
        fetch('https://docs.test/page', new AbortController().signal),
      ).rejects.toMatchObject({ code: 'unsupported-content-type' });
      return { articles: [], failures: [] };
    });
    deps.fetchPage.mockResolvedValue({
      status: 200,
      contentType: '',
      responseText: 'plain text',
      finalUrl: 'https://docs.test/page',
    });
    await createApp(deps).start();
    expect(deps.extractArticle).not.toHaveBeenCalled();
    expect(target.close).toHaveBeenCalled();
  });

  it('logs and closes the blank window when every page fails', async () => {
    const deps = dependencies();
    deps.showXPathDialog.mockResolvedValue('//links');
    deps.discoverLinks.mockReturnValue(
      Object.assign([{ text: 'Page', url: 'https://docs.test/page', selected: true }], {
        truncated: false,
      }),
    );
    deps.showLinksDialog.mockResolvedValue({
      kind: 'selected',
      links: [{ text: 'Page', url: 'https://docs.test/page', selected: true }],
    });
    deps.runBatch.mockResolvedValue({
      articles: [],
      failures: [{ url: 'https://docs.test/page', code: 'http-error', message: 'HTTP 500' }],
    });
    await createApp(deps).start();
    expect(target.close).toHaveBeenCalled();
    expect(deps.showToast).toHaveBeenCalledWith(expect.stringContaining('HTTP 500'));
  });

  it('uses a preview button when the popup is blocked', async () => {
    const deps = dependencies();
    deps.showXPathDialog.mockResolvedValue('//links');
    deps.discoverLinks.mockReturnValue(
      Object.assign([{ text: 'Page', url: 'https://docs.test/page', selected: true }], {
        truncated: false,
      }),
    );
    deps.showLinksDialog.mockResolvedValue({
      kind: 'selected',
      links: [{ text: 'Page', url: 'https://docs.test/page', selected: true }],
    });
    deps.window.open = vi.fn(() => null) as unknown as Window['open'];
    deps.runBatch.mockResolvedValue({
      articles: [{ title: 'Page', content: '<p>x</p>', url: 'https://docs.test/page' }],
      failures: [],
    });
    await createApp(deps).start();
    expect(deps.showPreviewButton).toHaveBeenCalled();
    expect(deps.showPreview).not.toHaveBeenCalled();
  });
});
