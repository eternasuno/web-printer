export const DIALOG_STYLES = `
#wp-overlay {
  position: fixed; inset: 0; z-index: 2147483646;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  color-scheme: light only;
}
#wp-overlay *,
#wp-overlay *::before,
#wp-overlay *::after {
  box-sizing: border-box;
}
#wp-dialog {
  background: #fff; color: #333; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  width: 640px; max-width: 90vw; max-height: 85vh; display: flex;
  flex-direction: column; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 14px; line-height: 1.5; text-align: left;
}
#wp-dialog-header {
  padding: 16px 24px; border-bottom: 1px solid #e0e0e0;
  display: flex; align-items: center; justify-content: space-between;
}
#wp-dialog-header h2 { margin: 0; font-size: 16px; font-weight: 700; color: #333; }
#wp-close-btn {
  width: 28px; height: 28px; border-radius: 50%; border: none;
  background: #f0f0f0; cursor: pointer; font-size: 14px; line-height: 1;
  display: flex; align-items: center; justify-content: center; color: #666;
  padding: 0; font-family: inherit;
}
#wp-close-btn:hover { background: #e0e0e0; }
#wp-dialog-body { padding: 20px 24px; overflow-y: auto; flex: 1; color: #333; font-size: 14px; }
#wp-dialog-body p { margin: 0 0 12px; color: #333; font-size: 14px; }
#wp-dialog-body strong { color: #333; font-weight: 700; }
#wp-dialog-body code {
  font-size: 12px; background: #f0f0f0; color: #888;
  padding: 1px 4px; border-radius: 3px; font-family: monospace;
}
#wp-dialog-footer {
  padding: 12px 24px; border-top: 1px solid #e0e0e0;
  display: flex; justify-content: flex-end; gap: 8px;
}
.wp-input {
  width: 100%; padding: 10px 12px; border: 1px solid #d0d0d0;
  border-radius: 6px; font-size: 14px; font-family: monospace;
  color: #333; background: #fff; outline: none;
  line-height: 1.5; margin: 0;
}
.wp-input:focus { border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26,115,232,0.15); }
.wp-btn {
  padding: 8px 16px; border: none; border-radius: 6px; font-size: 13px;
  cursor: pointer; font-family: inherit; line-height: 1.5;
  transition: background 0.15s; margin: 0;
}
.wp-btn-primary { background: #1a73e8; color: #fff; }
.wp-btn-primary:hover { background: #1557b0; }
.wp-btn-secondary { background: #f0f0f0; color: #333; }
.wp-btn-secondary:hover { background: #e0e0e0; }
#wp-link-count { font-size: 13px; color: #666; margin-bottom: 12px; }
#wp-link-count strong { color: #333; }
#wp-select-all {
  display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
  font-size: 13px; cursor: pointer; color: #1a73e8; user-select: none;
  line-height: 1.5;
}
#wp-select-all input[type="checkbox"] {
  margin: 0; accent-color: #1a73e8;
}
#wp-link-list {
  border: 1px solid #e0e0e0; border-radius: 6px; max-height: 350px;
  overflow-y: auto; background: #fff;
}
.wp-link-item {
  display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px;
  border-bottom: 1px solid #f0f0f0; font-size: 13px; cursor: pointer; color: #333;
  background: transparent; line-height: 1.4; margin: 0;
}
.wp-link-item:last-child { border-bottom: none; }
.wp-link-item:hover { background: #f5f8ff; }
.wp-link-item input[type="checkbox"] { margin: 2px 0 0; flex-shrink: 0; accent-color: #1a73e8; }
.wp-link-content { overflow: hidden; min-width: 0; }
.wp-link-title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #333; font-weight: 500; }
.wp-link-url { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #888; font-size: 11px; margin-top: 1px; }
#wp-progress-widget {
  position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
  background: #fff; border-radius: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.25);
  padding: 8px 14px; min-width: 200px; max-width: 320px;
  display: flex; align-items: center; gap: 10px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px; color: #333; line-height: 1.4;
}
#wp-progress-mini-bar {
  flex: 1; height: 6px; background: #e0e0e0; border-radius: 3px; overflow: hidden;
}
#wp-progress-mini-fill {
  height: 100%; background: #1a73e8; border-radius: 3px;
  transition: width 0.3s;
}
#wp-progress-mini-text {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-size: 12px; color: #666;
}
#wp-progress-cancel {
  width: 28px; height: 28px; border-radius: 50%; border: none;
  background: #f0f0f0; cursor: pointer; font-size: 14px; line-height: 1;
  display: flex; align-items: center; justify-content: center; color: #666;
  padding: 0; flex-shrink: 0; font-family: inherit;
}
#wp-progress-cancel:hover { background: #e0e0e0; color: #333; }
#wp-toast {
  position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
  z-index: 2147483647; background: #333; color: #fff; padding: 10px 20px;
  border-radius: 8px; font-size: 14px; display: none;
  box-shadow: 0 2px 12px rgba(0,0,0,0.2);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.5; text-align: center;
}
#wp-toast.show { display: block; }
.wp-advanced-toggle {
  margin-top: 4px; padding: 0; border: none; background: none; cursor: pointer;
  font-family: inherit; font-size: 13px; color: #1a73e8; user-select: none;
}
.wp-advanced-toggle:hover { text-decoration: underline; }
.wp-advanced-section {
  margin-top: 12px; padding: 12px; border: 1px solid #e0e0e0; border-radius: 6px;
  background: #fafafa; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
}
.wp-config-field {
  display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #555;
}
.wp-config-field span { font-weight: 500; }
.wp-config-input { padding: 6px 8px; font-size: 13px; }
`;

export const injectStyles = (): void => {
  if (document.getElementById('wp-styles')) return;
  const style = document.createElement('style');
  style.id = 'wp-styles';
  style.textContent = DIALOG_STYLES;
  document.head.appendChild(style);
};
