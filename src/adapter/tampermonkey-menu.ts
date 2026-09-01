import type { MenuRegistrar } from '../port';

export const createMenuRegistrar = (): MenuRegistrar => ({
  register: (label, handler) => {
    GM_registerMenuCommand(label, handler);
  },
});
