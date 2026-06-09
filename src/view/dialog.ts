import type { LinkInfo } from '../core/entity';
import { DEFAULT_PRINT_CSS } from '../core/usecase';

const escaped = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const selectorDialogHtml = (): string => `
  <div id="wp-dialog">
    <div id="wp-dialog-header">
      <h2>Web Printer</h2>
      <button id="wp-close-btn">✕</button>
    </div>
    <div id="wp-dialog-body">
      <p style="margin:0 0 12px;font-size:14px;color:#333;">Enter a CSS selector to discover page links:</p>
      <input id="wp-selector-input" class="wp-input" type="text"
        placeholder="e.g.: nav a, .sidebar a[href*='/docs/']" value="a[href]" autofocus />
      <p class="wp-hint">The script will find matching &lt;a&gt; elements and extract their href.</p>
    </div>
    <div id="wp-dialog-footer">
      <button id="wp-find-btn" class="wp-btn wp-btn-primary">Find Links</button>
    </div>
  </div>
`;

const settingsDialogHtml = (): string => `
  <div id="wp-dialog">
    <div id="wp-dialog-header">
      <h2>Web Printer Settings</h2>
      <button id="wp-close-btn">✕</button>
    </div>
    <div id="wp-dialog-body">
      <p style="margin:0 0 8px;font-size:14px;color:#333;">Custom print CSS (leave empty for default):</p>
      <textarea id="wp-css-input" class="wp-input" rows="15" spellcheck="false" placeholder="Leave empty for default print styles..."></textarea>
      <button id="wp-reset-css-btn" class="wp-btn wp-btn-secondary" style="margin-top:8px;">Reset to Default</button>
    </div>
    <div id="wp-dialog-footer">
      <button id="wp-save-btn" class="wp-btn wp-btn-primary">Save</button>
    </div>
  </div>
`;

const createOverlay = (html: string): HTMLDivElement => {
  const overlay = document.createElement('div');
  overlay.id = 'wp-overlay';
  overlay.innerHTML = html;
  return overlay;
};

export const promptSelector = (initialSelector?: string): Promise<string | null> =>
  new Promise((resolve) => {
    const overlay = createOverlay(selectorDialogHtml());
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#wp-selector-input') as HTMLInputElement;
    const findBtn = overlay.querySelector('#wp-find-btn') as HTMLElement;
    const closeBtn = overlay.querySelector('#wp-close-btn') as HTMLElement;

    if (initialSelector) {
      input.value = initialSelector;
    }

    const submit = (): void => {
      const selector = input.value.trim();
      if (!selector) return;
      overlay.remove();
      resolve(selector);
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') submit();
    };
    findBtn.onclick = submit;
    closeBtn.onclick = () => {
      overlay.remove();
      resolve(null);
    };
    setTimeout(() => input.focus(), 100);
  });

export const promptSettings = (currentCss: string): Promise<string | null> =>
  new Promise((resolve) => {
    const overlay = createOverlay(settingsDialogHtml());
    document.body.appendChild(overlay);
    const cssInput = overlay.querySelector('#wp-css-input') as HTMLTextAreaElement;
    const resetBtn = overlay.querySelector('#wp-reset-css-btn') as HTMLElement;
    const saveBtn = overlay.querySelector('#wp-save-btn') as HTMLElement;
    const closeBtn = overlay.querySelector('#wp-close-btn') as HTMLElement;

    cssInput.value = currentCss;

    resetBtn.onclick = (): void => {
      cssInput.value = DEFAULT_PRINT_CSS;
    };
    saveBtn.onclick = (): void => {
      overlay.remove();
      resolve(cssInput.value.trim());
    };
    closeBtn.onclick = () => {
      overlay.remove();
      resolve(null);
    };
    setTimeout(() => cssInput.focus(), 100);
  });

const buildLinkItemHtml = (params: { link: LinkInfo; checked: boolean }): string => {
  const title = escaped(params.link.text);
  const url = escaped(params.link.url);
  return `<label class="wp-link-item">
      <input type="checkbox" class="wp-link-checkbox" value="${url}" ${params.checked ? 'checked' : ''} />
      <span class="wp-link-content">
        <span class="wp-link-title" title="${title}">${title}</span>
        <span class="wp-link-url" title="${url}">${url}</span>
      </span>
    </label>`;
};

const buildLinkItemsHtml = (params: { links: LinkInfo[]; allChecked: boolean }): string =>
  params.links.map((link) => buildLinkItemHtml({ checked: params.allChecked, link })).join('');

const buildLinkDialogHtml = (params: { links: LinkInfo[]; allChecked: boolean }): string => {
  const { links, allChecked } = params;
  return `
    <div id="wp-dialog">
      <div id="wp-dialog-header">
        <h2>Web Printer</h2>
        <button id="wp-close-btn">✕</button>
      </div>
      <div id="wp-dialog-body">
        <div id="wp-link-count">Found <strong>${links.length}</strong> links</div>
        <label id="wp-select-all">
          <input type="checkbox" id="wp-select-all-checkbox" ${allChecked ? 'checked' : ''} />
          Select All
        </label>
        <div id="wp-link-list">${buildLinkItemsHtml(params)}</div>
      </div>
      <div id="wp-dialog-footer">
        <button id="wp-back-btn" class="wp-btn wp-btn-secondary">← Back</button>
        <button id="wp-print-btn" class="wp-btn wp-btn-primary">Print Selected (${allChecked ? links.length : 0})</button>
      </div>
    </div>
  `;
};

const updateCheckedCount = (overlay: HTMLElement): void => {
  const checked = overlay.querySelectorAll<HTMLInputElement>('.wp-link-checkbox:checked');
  const printBtn = overlay.querySelector('#wp-print-btn') as HTMLButtonElement;
  printBtn.textContent = `Print Selected (${checked.length})`;
};

const wireSelectAll = (overlay: HTMLElement): void => {
  const selectAll = overlay.querySelector('#wp-select-all-checkbox') as HTMLInputElement;
  const checkboxes = overlay.querySelectorAll<HTMLInputElement>('.wp-link-checkbox');
  selectAll.onchange = () => {
    for (const cb of checkboxes) cb.checked = selectAll.checked;
    updateCheckedCount(overlay);
  };
};

const wireLinkCheckboxes = (overlay: HTMLElement): void => {
  const checkboxes = overlay.querySelectorAll<HTMLInputElement>('.wp-link-checkbox');
  for (const cb of checkboxes) cb.onchange = () => updateCheckedCount(overlay);
};

const getCheckedUrls = (overlay: HTMLElement): string[] => {
  const checked: string[] = [];
  for (const cb of overlay.querySelectorAll<HTMLInputElement>('.wp-link-checkbox:checked')) {
    checked.push(cb.value);
  }
  return checked;
};

export const selectLinks = (links: LinkInfo[]): Promise<string[] | null> =>
  new Promise((resolve) => {
    const allChecked = links.length <= 50;
    const overlay = createOverlay(buildLinkDialogHtml({ allChecked, links }));
    document.body.appendChild(overlay);
    wireSelectAll(overlay);
    wireLinkCheckboxes(overlay);
    const printBtn = overlay.querySelector('#wp-print-btn') as HTMLButtonElement;
    const backBtn = overlay.querySelector('#wp-back-btn') as HTMLElement;
    const closeBtn = overlay.querySelector('#wp-close-btn') as HTMLElement;
    printBtn.onclick = () => {
      const checked = getCheckedUrls(overlay);
      if (checked.length === 0) return;
      overlay.remove();
      resolve(checked);
    };
    backBtn.onclick = () => {
      overlay.remove();
      resolve(null);
    };
    closeBtn.onclick = () => {
      overlay.remove();
      resolve([]);
    };
  });
