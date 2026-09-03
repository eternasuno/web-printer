import { Effect, Layer } from 'effect';
import { HtmlSanitizerLive } from './adapter/dompurify';
import { PageFetcherLive } from './adapter/gm-fetch';
import { HtmlDocumentParserLive } from './adapter/html-document';
import { ArticleExtractorLive } from './adapter/readability';
import { openPreview } from './presentation/preview-window';
import { createLinkSelector } from './presentation/selection-dialog';
import { createNotifier } from './presentation/toast';
import { assemble } from './usecase/assemble';
import { collect } from './usecase/collect';
import { discover } from './usecase/discover';

const CollectionLive = Layer.mergeAll(
  PageFetcherLive,
  HtmlDocumentParserLive,
  ArticleExtractorLive,
  HtmlSanitizerLive
);

const run = async (controller: AbortController): Promise<void> => {
  const notifier = createNotifier();
  const candidates = discover(document);
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
    document.title || location.hostname,
    () => controller.abort()
  );
  if (!preview) {
    notifier.show('Allow popups to start Web Printer');

    return;
  }

  const results = await Effect.runPromise(
    Effect.provide(
      collect(selected, {
        onProgress: (progress) => preview.update(progress),
      }),
      CollectionLive
    ),
    { signal: controller.signal }
  );
  if (controller.signal.aborted) {
    return;
  }

  preview.update({
    completed: selected.length,
    total: selected.length,
    state: 'assembling',
  });
  preview.render(assemble(document.title, location.hostname, results));
};

GM_registerMenuCommand('Web Printer', () => {
  const controller = new AbortController();
  void run(controller).catch((error: unknown) => {
    if (!controller.signal.aborted) {
      createNotifier().show(
        error instanceof Error ? error.message : 'Unexpected error'
      );
    }
  });
});
