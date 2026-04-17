// Native contenteditable wrapper. Used by /new/ and /edit/.
//
// Intentionally minimal: provides the formatting/link/image insertion
// actions the existing tools wire up to toolbar buttons. Image resize
// is a separate modal — see the `openImageResize` helper.
//
// Usage:
//   const editor = new RichEditor({ element: document.getElementById('editor') });
//   toolbarBtn.addEventListener('click', () => editor.execCommand('bold'));
//   editor.getHTML();  // serialize
//   editor.insertImage({ src: '...', alt: '...' });

export class RichEditor {
  constructor({ element, onChange } = {}) {
    if (!element) throw new Error('RichEditor: element is required');
    this.el = element;
    this.el.setAttribute('contenteditable', 'true');
    if (onChange) {
      this.el.addEventListener('input', () => onChange(this.getHTML()));
    }
  }

  getHTML() { return this.el.innerHTML; }

  getText() { return this.el.innerText; }

  setHTML(html) { this.el.innerHTML = html || ''; }

  focus() { this.el.focus(); }

  // document.execCommand is deprecated but still works in every browser,
  // and it's what the existing tools use. We're not here to modernize
  // that — we're here to consolidate.
  execCommand(command, value) {
    this.el.focus();
    document.execCommand(command, false, value);
  }

  insertLink(url, text) {
    const trimmedUrl = (url || '').trim();
    if (!trimmedUrl) return;
    this.el.focus();
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) {
      document.execCommand('createLink', false, trimmedUrl);
    } else {
      const linkHtml = `<a href="${escapeHtml(trimmedUrl)}">${escapeHtml(text || trimmedUrl)}</a>`;
      this.insertHTML(linkHtml);
    }
  }

  insertHTML(html) {
    this.el.focus();
    document.execCommand('insertHTML', false, html);
  }

  insertImage({ src, alt = '', width, height, className = 'aligncenter size-large' } = {}) {
    if (!src) return;
    const attrs = [
      `src="${escapeHtml(src)}"`,
      `alt="${escapeHtml(alt)}"`,
      className ? `class="${escapeHtml(className)}"` : '',
      width ? `width="${Number(width)}"` : '',
      height ? `height="${Number(height)}"` : '',
    ].filter(Boolean).join(' ');
    this.insertHTML(`<p><img ${attrs}></p>`);
  }
}

// Open an image resize modal. Simple width/height pickers plus percent
// quick-sizes. Calls `onResize({ width, height })` when user confirms.
//
// This is a DOM-light helper: the caller supplies the modal container;
// we manage state inside it.
export function openImageResize({ container, image, onResize, onCancel }) {
  if (!container || !image) return;
  const naturalW = image.naturalWidth || image.width || 0;
  const naturalH = image.naturalHeight || image.height || 0;
  const aspect = naturalW && naturalH ? naturalW / naturalH : 1;

  container.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <label>Width <input type="number" data-ir="w" value="${image.width || naturalW}" min="10" style="width:100px"></label>
      <label>Height <input type="number" data-ir="h" value="${image.height || naturalH}" min="10" style="width:100px"></label>
      <label><input type="checkbox" data-ir="lock" checked> Keep aspect</label>
      <div style="display:flex;gap:4px">
        <button data-ir-pct="25">25%</button>
        <button data-ir-pct="50">50%</button>
        <button data-ir-pct="75">75%</button>
        <button data-ir-pct="100">100%</button>
      </div>
      <button data-ir-action="apply" style="font-weight:600">Apply</button>
      <button data-ir-action="cancel">Cancel</button>
    </div>
  `;

  const w = container.querySelector('[data-ir="w"]');
  const h = container.querySelector('[data-ir="h"]');
  const lock = container.querySelector('[data-ir="lock"]');

  w.addEventListener('input', () => {
    if (lock.checked && aspect) h.value = Math.round(Number(w.value) / aspect);
  });
  h.addEventListener('input', () => {
    if (lock.checked && aspect) w.value = Math.round(Number(h.value) * aspect);
  });
  container.querySelectorAll('[data-ir-pct]').forEach(b => {
    b.addEventListener('click', () => {
      const pct = Number(b.dataset.irPct) / 100;
      w.value = Math.round(naturalW * pct);
      h.value = Math.round(naturalH * pct);
    });
  });
  container.querySelector('[data-ir-action="apply"]').addEventListener('click', () => {
    onResize && onResize({ width: Number(w.value), height: Number(h.value) });
  });
  container.querySelector('[data-ir-action="cancel"]').addEventListener('click', () => {
    onCancel && onCancel();
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
