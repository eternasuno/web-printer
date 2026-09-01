import { createHtmlSanitizer } from './adapter/dompurify';
import { createPageFetcher } from './adapter/gm-fetch';
import { createHtmlTransformer } from './adapter/html-document';
import { createPageReader } from './adapter/page-dom';
import { openPreview } from './adapter/preview-window';
import { createArticleExtractor } from './adapter/readability';
import { createLinkSelector } from './adapter/selection-dialog';
import { createMenuRegistrar } from './adapter/tampermonkey-menu';
import { createNotifier } from './adapter/toast';
import { assemble } from './usecase/assemble';
import { collect } from './usecase/collect';
import { discover } from './usecase/discover';

const collectionAdapters = () => ({
  fetcher: createPageFetcher(),
  extractor: createArticleExtractor(),
  transformer: createHtmlTransformer(),
  sanitizer: createHtmlSanitizer(),
});

const run = async (): Promise<void> => {
  const notifier = createNotifier();
  const snapshot = createPageReader().readPage();
  const candidates = discover(snapshot);
  if (!candidates.length) {
    notifier.show('No pages found');

    return;
  }

  const selected = await createLinkSelector().select(candidates);
  if (!selected?.length) {
    return;
  }

  const taskId = crypto.randomUUID();
  const preview = openPreview(
    undefined,
    taskId,
    snapshot.title || location.hostname
  );
  if (!preview) {
    notifier.show('Allow popups to start Web Printer');

    return;
  }

  const results = await collect(selected, collectionAdapters(), {
    isCancelled: () => preview.isCancelled() || preview.isClosed(),
    onProgress: (progress) => preview.update(progress),
  });
  if (preview.isClosed()) {
    notifier.show('Web Printer task cancelled');
    return;
  }

  preview.update({
    completed: selected.length,
    total: selected.length,
    state: 'assembling',
  });
  preview.render(assemble(snapshot.title, location.hostname, results));
};

createMenuRegistrar().register('Web Printer', () => {
  void run().catch((error: unknown) => {
    createNotifier().show(
      error instanceof Error ? error.message : 'Unexpected error'
    );
  });
});
