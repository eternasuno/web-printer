import type { ProgressState } from '../core/entity';

let _cancelled = false;

export const isCancelled = (): boolean => _cancelled;

const createProgressWidget = (state: ProgressState): void => {
  _cancelled = false;
  const widget = document.createElement('div');
  widget.id = 'wp-progress-widget';
  widget.innerHTML = `
    <div id="wp-progress-mini-bar"><div id="wp-progress-mini-fill" style="width:0%"></div></div>
    <span id="wp-progress-mini-text">${state.phase}</span>
    <button id="wp-progress-cancel" title="Cancel">✕</button>
  `;
  document.body.appendChild(widget);
  const cancelBtn = widget.querySelector('#wp-progress-cancel') as HTMLElement;
  cancelBtn.onclick = () => {
    _cancelled = true;
    widget.remove();
  };
};

const updateProgressWidget = (state: ProgressState): void => {
  const text = document.getElementById('wp-progress-mini-text');
  const fill = document.getElementById('wp-progress-mini-fill');
  if (!text || !fill) return;
  text.textContent = `${state.phase} (${state.done}/${state.total})`;
  const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
  fill.style.width = `${Math.min(pct, 100)}%`;
};

export const showProgress = (state: ProgressState): void => {
  const existing = document.getElementById('wp-progress-widget');
  if (!existing) {
    createProgressWidget(state);
    return;
  }
  updateProgressWidget(state);
};

export const removeProgress = (): void => {
  document.getElementById('wp-progress-widget')?.remove();
  _cancelled = false;
};

const getOrCreateToast = (): HTMLElement => {
  const existing = document.getElementById('wp-toast');
  if (existing) return existing;
  const toast = document.createElement('div');
  toast.id = 'wp-toast';
  document.body.appendChild(toast);
  return toast;
};

export const showToast = (msg: string): void => {
  const toast = getOrCreateToast();
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
};
