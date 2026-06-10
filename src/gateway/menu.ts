declare function GM_registerMenuCommand(name: string, callback: () => void): void;

export const registerMenu = (callbacks: {
  onStart: () => void;
  onSettings: () => void;
}): void => {
  GM_registerMenuCommand('Web Printer', callbacks.onStart);
  GM_registerMenuCommand('Web Printer Settings', callbacks.onSettings);
};