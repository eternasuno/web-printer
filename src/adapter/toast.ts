import type { INotifier } from '../port';

const durationMs = 4_000;

export const createNotifier = (page: Document = document): INotifier => ({
  show: (message) => {
    const toast = page.createElement('div');
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      zIndex: '2147483647',
      right: '1rem',
      bottom: '1rem',
      maxWidth: '24rem',
      padding: '.75rem 1rem',
      color: '#fff',
      background: '#222',
      borderRadius: '.4rem',
      font: '14px system-ui, sans-serif',
    });
    page.body.append(toast);
    setTimeout(() => toast.remove(), durationMs);
  },
});
