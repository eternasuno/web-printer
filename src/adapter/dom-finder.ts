import type { RawLink } from '../core/port';

export const findLinks = (xpath: string, root: Document = document): RawLink[] => {
  const evaluator = (root as Document & { evaluate?: typeof document.evaluate }).evaluate;
  const snapshotType = root.defaultView?.XPathResult?.ORDERED_NODE_SNAPSHOT_TYPE ?? 7;
  if (!evaluator) throw new Error('XPath is not supported');
  const result = evaluator.call(root, xpath, root, null, snapshotType, null);
  const links: RawLink[] = [];
  const seen = new Set<HTMLAnchorElement>();
  for (let i = 0; i < result.snapshotLength; i++) {
    const node = result.snapshotItem(i);
    if (!(node instanceof Element)) {
      throw new Error('XPath must return elements');
    }
    const anchors = node.matches('a[href]') ? [node] : [...node.querySelectorAll('a[href]')];
    for (const anchor of anchors) {
      if (!(anchor instanceof HTMLAnchorElement) || seen.has(anchor)) continue;
      seen.add(anchor);
      links.push({
        text: anchor.textContent ?? '',
        href: anchor.getAttribute('href') ?? '',
        downloadable: anchor.hasAttribute('download'),
      });
    }
  }
  return links;
};
