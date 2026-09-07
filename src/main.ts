import { Effect, Layer } from 'effect';
import { HtmlSanitizerLive } from './adapter/dompurify';
import { PageFetcherLive } from './adapter/gm-fetch';
import { HtmlDocumentParserLive } from './adapter/html-document';
import { ArticleExtractorLive } from './adapter/readability';
import { openPreview } from './presentation/preview-window';
import { createLinkSelector } from './presentation/selection-dialog';
import { createNotifier } from './presentation/toast';
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
  const links = discover(document);
  if (!links.length) {
    notifier.show('No pages found');

    return;
  }

  const selectedLinks = await createLinkSelector().select(links);
  if (!selectedLinks?.length) {
    return;
  }

  const taskId = crypto.randomUUID();
  const title = document.title.trim() || location.hostname;
  const preview = openPreview(undefined, taskId, title, () =>
    controller.abort()
  );
  if (!preview) {
    notifier.show('Allow popups to start Web Printer');

    return;
  }

  const posts = await Effect.runPromise(
    Effect.provide(
      collect(selectedLinks, { onProgress: preview.update }),
      CollectionLive
    ),
    { signal: controller.signal }
  );
  if (controller.signal.aborted) {
    return;
  }

  preview.render({ title, posts });
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
