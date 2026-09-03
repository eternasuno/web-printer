import type { IMenuRegistrar } from '../port';

export const createMenuRegistrar = (): IMenuRegistrar => ({
  register: (label, handler) => {
    GM_registerMenuCommand(label, handler);
  },
});
