export const button = (
  page: Document,
  action: string,
  text: string
): HTMLButtonElement => {
  const element = page.createElement('button');
  element.type = 'button';
  element.setAttribute('data-action', action);
  element.textContent = text;

  return element;
};
