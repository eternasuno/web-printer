import type { BatchResult } from '../core/entity';

export const showPreview = (target: Window, result: BatchResult): void => {
  const doc = target.document;
  doc.open();
  doc.write(
    '<!doctype html><meta charset="utf-8"><title>Web Printer Preview</title><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src https:; style-src \'unsafe-inline\';"><div data-web-printer-preview="true"></div>'
  );
  doc.close();
  const root = doc.querySelector('[data-web-printer-preview]');
  if (!root) return;
  const style = doc.createElement('style');
  style.textContent =
    '@media print{button,aside{display:none}}article{page-break-before:always}article:first-of-type{page-break-before:auto}img{max-width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}th,td{border:1px solid #888;padding:.25rem}';
  root.append(style);
  if (result.failures.length) {
    const aside = doc.createElement('aside');
    aside.setAttribute('aria-label', 'Failures');
    result.failures.forEach((failure) => {
      const line = doc.createElement('div');
      line.textContent = `${failure.code}: ${failure.message}`;
      aside.append(line);
    });
    root.append(aside);
  }
  result.articles.forEach((article) => {
    const element = doc.createElement('article');
    const heading = doc.createElement('h1');
    heading.textContent = article.title;
    const body = doc.createElement('div');
    body.innerHTML = article.content;
    element.append(heading, body);
    root.append(element);
  });
  const print = doc.createElement('button');
  print.textContent = 'Print';
  print.onclick = () => target.print();
  root.prepend(print);
};
