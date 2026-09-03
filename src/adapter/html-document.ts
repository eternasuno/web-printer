import { Layer } from 'effect';
import { HtmlTransformer } from '../port';

const absolute = (value: string, base: string): string | null => {
  try {
    return new URL(value, base).href;
  } catch {
    return null;
  }
};

const srcset = (value: string, base: string): string =>
  value
    .split(',')
    .flatMap((part) => {
      const [candidate, ...descriptor] = part.trim().split(/\s+/);
      const url = candidate ? absolute(candidate, base) : null;

      return url
        ? [`${url}${descriptor.length ? ` ${descriptor.join(' ')}` : ''}`]
        : [];
    })
    .join(', ');

const setAbsolute = (
  element: Element,
  attribute: string,
  base: string
): void => {
  const value = element.getAttribute(attribute);
  if (!value) {
    return;
  }

  const normalized =
    attribute === 'srcset' ? srcset(value, base) : absolute(value, base);
  if (normalized) {
    element.setAttribute(attribute, normalized);
  } else {
    element.removeAttribute(attribute);
  }
};

const promoteLazyImages = (root: ParentNode): void => {
  for (const image of root.querySelectorAll('img')) {
    const lazySrc = image.getAttribute('data-src');
    const lazySrcset = image.getAttribute('data-srcset');
    if (!image.getAttribute('src') && lazySrc) {
      image.setAttribute('src', lazySrc);
    }
    if (!image.getAttribute('srcset') && lazySrcset) {
      image.setAttribute('srcset', lazySrcset);
    }
  }
};

const sameHeading = (left: string, right: string): boolean =>
  left.replace(/\s+/g, ' ').trim().toLowerCase() ===
  right.replace(/\s+/g, ' ').trim().toLowerCase();

export const HtmlTransformerLive = Layer.succeed(HtmlTransformer, {
  transform: (html, sourceUrl, title) => {
    const page = new DOMParser().parseFromString(html, 'text/html');
    promoteLazyImages(page);

    for (const element of page.querySelectorAll('[href], [src], [srcset]')) {
      for (const attribute of ['href', 'src', 'srcset']) {
        setAbsolute(element, attribute, sourceUrl);
      }
    }

    const first = page.body.firstElementChild;
    if (
      first?.tagName === 'H1' &&
      sameHeading(first.textContent ?? '', title)
    ) {
      first.remove();
    }

    return page.body.innerHTML;
  },
});
