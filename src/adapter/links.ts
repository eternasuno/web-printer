import type { SourceLink } from '../core/entity';

export type RawLink = { text: string; href: string; downloadable?: boolean };
export type DiscoverResult = SourceLink[] & { truncated: boolean };

const limit = 200;
const orderedNodeSnapshotType = 7;

type SnapshotList = {
  snapshotLength: number;
  snapshotItem(index: number): unknown;
};

const snapshotElements = (result: SnapshotList): Element[] => {
  const elements: Element[] = [];
  for (let i = 0; i < result.snapshotLength; i++) {
    const node = result.snapshotItem(i);
    if (!(node instanceof Element))
      throw new Error('XPath must return elements');
    elements.push(node);
  }
  return elements;
};

const findLinks = (xpath: string, root: Document): RawLink[] => {
  const evaluate = (root as Document & { evaluate?: typeof document.evaluate })
    .evaluate;
  const snapshotType =
    root.defaultView?.XPathResult?.ORDERED_NODE_SNAPSHOT_TYPE ??
    orderedNodeSnapshotType;
  if (!evaluate) throw new Error('XPath is not supported');
  const seen = new Set<HTMLAnchorElement>();
  const links: RawLink[] = [];
  const add = (node: Element): void => {
    if (!(node instanceof HTMLAnchorElement) || seen.has(node)) return;
    seen.add(node);
    links.push({
      text: node.textContent ?? '',
      href: node.getAttribute('href') ?? '',
      downloadable: node.hasAttribute('download'),
    });
  };
  const elements = snapshotElements(
    evaluate.call(root, xpath, root, null, snapshotType, null)
  );
  for (const element of elements) {
    const anchors = element.matches('a[href]')
      ? [element]
      : element.querySelectorAll('a[href]');
    for (const anchor of anchors) add(anchor);
  }
  return links;
};

const resolve = (href: string, base: URL): URL | undefined => {
  try {
    return new URL(href, base);
  } catch {
    return undefined;
  }
};

const sameOriginTarget = (url: URL, base: URL): boolean =>
  (url.protocol === 'http:' || url.protocol === 'https:') &&
  url.origin === base.origin &&
  !url.username &&
  !url.password;

const toSourceLink = (
  link: RawLink,
  base: URL,
  seen: Set<string>
): SourceLink | undefined => {
  const url =
    link.href && !link.downloadable ? resolve(link.href, base) : undefined;
  if (!url || !sameOriginTarget(url, base)) return undefined;
  url.hash = '';
  if (seen.has(url.href)) return undefined;
  seen.add(url.href);
  return { text: link.text.trim() || url.href, url: url.href };
};

export const discoverLinks = (
  xpath: string,
  pageUrl: string,
  root: Document = document
): DiscoverResult => {
  if (!xpath.trim()) throw new Error('XPath is required');
  const base = new URL(pageUrl);
  const seen = new Set<string>();
  const links = findLinks(xpath, root)
    .map((link) => toSourceLink(link, base, seen))
    .filter((link): link is SourceLink => link !== undefined);
  const result = links.slice(0, limit) as DiscoverResult;
  Object.defineProperty(result, 'truncated', {
    value: links.length > limit,
    enumerable: false,
  });
  return result;
};
