// RichEditor — a real visual editor on native contenteditable (Decision 015).
//
// Why not Quill/TipTap/Trix: they own the document model and normalize HTML
// on load, which strips the iframes, <figure>+srcset, galleries and other
// 2005–2026 WordPress markup this archive is made of. The browser's own
// editing surface leaves unknown HTML alone, so an old post survives a
// round-trip; everything that was missing from that (toolbar, shortcuts,
// consistent tags, clean paste, link/image handling) lives here.
//
// Usage:
//   const editor = new RichEditor({ element, onChange, onImage });
//   editor.getHTML() / setHTML(html) / insertHTML(html) / focus()
// `onImage` (optional) is called from the toolbar's image button; the view
// opens its uploader and calls insertHTML with the result.

const BLOCKS = [['p', 'Paragraph'], ['h2', 'Heading 2'], ['h3', 'Heading 3'], ['h4', 'Heading 4'], ['blockquote', 'Quote'], ['pre', 'Code block']];
const KEEP_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre', 'blockquote', 'img', 'br', 'hr', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sup', 'sub']);
const KEEP_ATTRS = { a: ['href', 'title'], img: ['src', 'alt', 'width', 'height', 'srcset', 'sizes'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] };
const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

const TOOLS = [
  { id: 'block', kind: 'select' },
  { id: 'bold', label: '<b>B</b>', title: `Bold (${MOD}+B)`, cmd: 'bold', state: 'bold' },
  { id: 'italic', label: '<i>I</i>', title: `Italic (${MOD}+I)`, cmd: 'italic', state: 'italic' },
  { id: 'underline', label: '<u>U</u>', title: `Underline (${MOD}+U)`, cmd: 'underline', state: 'underline' },
  { id: 'strike', label: '<s>S</s>', title: `Strikethrough (${MOD}+Shift+X)`, cmd: 'strikeThrough', state: 'strikeThrough' },
  { id: 'code', label: '<code>&lt;/&gt;</code>', title: `Inline code (${MOD}+E)`, action: 'inlineCode', tag: 'code' },
  { sep: true },
  { id: 'link', label: '🔗', title: `Link (${MOD}+K)`, action: 'link', tag: 'a' },
  { id: 'image', label: '🖼', title: 'Insert image…', action: 'image' },
  { sep: true },
  { id: 'ul', label: '•≡', title: `Bulleted list (${MOD}+Shift+8)`, cmd: 'insertUnorderedList', state: 'insertUnorderedList' },
  { id: 'ol', label: '1≡', title: `Numbered list (${MOD}+Shift+7)`, cmd: 'insertOrderedList', state: 'insertOrderedList' },
  { id: 'quote', label: '❝', title: `Quote (${MOD}+Shift+9)`, action: 'block', value: 'blockquote', tag: 'blockquote' },
  { id: 'hr', label: '—', title: 'Horizontal rule', cmd: 'insertHorizontalRule' },
  { sep: true },
  { id: 'undo', label: '↶', title: `Undo (${MOD}+Z)`, cmd: 'undo' },
  { id: 'redo', label: '↷', title: `Redo (${MOD}+Shift+Z)`, cmd: 'redo' },
  { id: 'clear', label: 'Tx', title: 'Clear formatting', action: 'clear' },
];

export class RichEditor {
  constructor({ element, onChange, onImage } = {}) {
    if (!element) throw new Error('RichEditor: element is required');
    this.el = element; this.onImage = onImage; this.onChange = onChange;
    this.el.setAttribute('contenteditable', 'true');
    this.el.setAttribute('spellcheck', 'true');
    this.el.classList.add('rte-surface');
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, false); } catch { /* old engines */ }
    this._buildToolbar();
    this._buildImagePopover();
    this.el.addEventListener('input', () => this._changed());
    this.el.addEventListener('keydown', (e) => this._keydown(e));
    this.el.addEventListener('paste', (e) => this._paste(e));
    this.el.addEventListener('click', (e) => this._click(e));
    document.addEventListener('selectionchange', () => { if (this.el.contains(document.getSelection()?.anchorNode)) this._refresh(); });
  }

  // ---- public API ----------------------------------------------------------
  getHTML() { return this._serialize(); }
  getText() { return this.el.innerText; }
  setHTML(html) { this.el.innerHTML = html || ''; this._refresh(); }
  focus() { this.el.focus(); }
  // Visual ↔ HTML: the view hides the surface; this hides the toolbar and image popover with it.
  showChrome(on) { if (this.bar) this.bar.hidden = !on; if (!on) this._hideImg(); }
  execCommand(command, value) { this.el.focus(); document.execCommand(command, false, value); this._changed(); }
  insertHTML(html) { this.el.focus(); this._restoreSelection(); document.execCommand('insertHTML', false, html); this._changed(); }
  insertLink(url, text) { const u = String(url || '').trim(); if (!u) return; this.el.focus(); const sel = getSelection(); if (sel && sel.toString()) document.execCommand('createLink', false, u); else this.insertHTML(`<a href="${esc(u)}">${esc(text || u)}</a>`); this._changed(); }

  // ---- toolbar -----------------------------------------------------------
  _buildToolbar() {
    const bar = document.createElement('div'); bar.className = 'rte-toolbar'; bar.setAttribute('role', 'toolbar');
    for (const t of TOOLS) {
      if (t.sep) { const s = document.createElement('span'); s.className = 'rte-sep'; bar.appendChild(s); continue; }
      if (t.kind === 'select') {
        const sel = document.createElement('select'); sel.className = 'rte-block'; sel.title = `Block type (${MOD}+Alt+0…4)`;
        sel.innerHTML = BLOCKS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
        sel.onchange = () => { this._block(sel.value); };
        sel.addEventListener('mousedown', () => this._saveSelection());
        bar.appendChild(sel); this.blockSelect = sel; continue;
      }
      const b = document.createElement('button'); b.type = 'button'; b.className = 'rte-btn'; b.dataset.tool = t.id; b.title = t.title; b.innerHTML = t.label;
      b.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection in the surface
      b.addEventListener('click', () => this._run(t));
      bar.appendChild(b);
    }
    this.el.parentNode.insertBefore(bar, this.el); this.bar = bar;
    if (!this.onImage) bar.querySelector('[data-tool="image"]').hidden = true;
  }
  _run(t) {
    this.el.focus();
    if (t.cmd) { document.execCommand(t.cmd, false, null); this._changed(); return; }
    if (t.action === 'block') { this._block(this._inside(t.tag) ? 'p' : t.value); return; }
    if (t.action === 'inlineCode') { this._toggleInline('code'); return; }
    if (t.action === 'link') { this._link(); return; }
    if (t.action === 'image') { this._saveSelection(); this.onImage?.(); return; }
    if (t.action === 'clear') { document.execCommand('removeFormat', false, null); const a = this._inside('a'); if (a) document.execCommand('unlink', false, null); this._changed(); return; }
  }
  _refresh() {
    if (!this.bar) return;
    for (const t of TOOLS) {
      if (!t.id || t.kind) continue;
      const b = this.bar.querySelector(`[data-tool="${t.id}"]`); if (!b) continue;
      let on = false;
      try { if (t.state) on = document.queryCommandState(t.state); } catch { /* ignore */ }
      if (t.tag) on = !!this._inside(t.tag);
      b.classList.toggle('active', on);
    }
    const blk = this._blockEl(); this.blockSelect.value = blk && BLOCKS.some(([v]) => v === blk.tagName.toLowerCase()) ? blk.tagName.toLowerCase() : 'p';
  }

  // ---- selection helpers -----------------------------------------------
  _saveSelection() { const s = getSelection(); if (s && s.rangeCount && this.el.contains(s.anchorNode)) this._range = s.getRangeAt(0).cloneRange(); }
  _restoreSelection() { if (!this._range) return; const s = getSelection(); s.removeAllRanges(); s.addRange(this._range); }
  _node() { const s = getSelection(); if (!s || !s.rangeCount) return null; let n = s.anchorNode; if (n && n.nodeType === 3) n = n.parentNode; return this.el.contains(n) ? n : null; }
  _inside(tag) { let n = this._node(); while (n && n !== this.el) { if (n.tagName && n.tagName.toLowerCase() === tag) return n; n = n.parentNode; } return null; }
  _blockEl() { let n = this._node(); while (n && n !== this.el) { if (n.parentNode === this.el && n.nodeType === 1) return n; n = n.parentNode; } return null; }

  // ---- actions -----------------------------------------------------------
  _block(tag) {
    this.el.focus();
    const cur = this._blockEl();
    if (cur && cur.tagName.toLowerCase() === 'blockquote' && tag !== 'blockquote') document.execCommand('formatBlock', false, 'p'); // leave the quote first
    document.execCommand('formatBlock', false, tag === 'p' ? 'p' : tag);
    this._changed();
  }
  _toggleInline(tag) {
    const s = getSelection(); if (!s || !s.rangeCount) return;
    const existing = this._inside(tag);
    if (existing) { const t = document.createTextNode(existing.textContent); existing.replaceWith(t); this._changed(); return; }
    const r = s.getRangeAt(0); if (r.collapsed) { this.insertHTML(`<${tag}>​</${tag}>`); return; }
    const w = document.createElement(tag); w.appendChild(r.extractContents()); r.insertNode(w); s.removeAllRanges(); const nr = document.createRange(); nr.selectNodeContents(w); s.addRange(nr); this._changed();
  }
  _link() {
    const a = this._inside('a');
    const url = prompt(a ? 'Edit link (empty to remove):' : 'Link URL:', a ? a.getAttribute('href') : 'https://');
    if (url === null) return;
    this.el.focus();
    if (a) { if (!url.trim()) { a.replaceWith(...a.childNodes); } else a.setAttribute('href', url.trim()); this._changed(); return; }
    this.insertLink(url);
  }
  _keydown(e) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'k') { e.preventDefault(); this._link(); return; }
      if (k === 'e') { e.preventDefault(); this._toggleInline('code'); return; }
      if (e.shiftKey && k === 'x') { e.preventDefault(); document.execCommand('strikeThrough'); this._changed(); return; }
      if (e.shiftKey && e.code === 'Digit8') { e.preventDefault(); document.execCommand('insertUnorderedList'); this._changed(); return; }
      if (e.shiftKey && e.code === 'Digit7') { e.preventDefault(); document.execCommand('insertOrderedList'); this._changed(); return; }
      if (e.shiftKey && e.code === 'Digit9') { e.preventDefault(); this._block(this._inside('blockquote') ? 'p' : 'blockquote'); return; }
    }
    if (mod && e.altKey && /^Digit[0-4]$/.test(e.code)) { e.preventDefault(); const n = e.code.slice(-1); this._block(n === '0' ? 'p' : n === '1' ? 'h2' : n === '2' ? 'h3' : n === '3' ? 'h4' : 'blockquote'); return; }
    if (e.key === 'Tab' && this._inside('li')) { e.preventDefault(); document.execCommand(e.shiftKey ? 'outdent' : 'indent'); this._changed(); return; }
    if (e.key === 'Enter' && !e.shiftKey) {
      const blk = this._blockEl();
      if (blk && /^H[1-6]$/.test(blk.tagName) && blk.textContent.length && getSelection().isCollapsed && this._caretAtEndOf(blk)) {
        // Enter at the end of a heading starts a paragraph, not another heading
        e.preventDefault(); const p = document.createElement('p'); p.innerHTML = '<br>'; blk.after(p);
        const s = getSelection(), nr = document.createRange(); nr.setStart(p, 0); nr.collapse(true); s.removeAllRanges(); s.addRange(nr); this._changed(); return;
      }
    }
    if (e.key === ' ') this._autoformat();
  }
  _caretAtEndOf(el) { const s = getSelection(); const r = s.getRangeAt(0).cloneRange(); r.selectNodeContents(el); r.setStart(s.getRangeAt(0).endContainer, s.getRangeAt(0).endOffset); return r.toString().length === 0; }
  // Markdown-style starts: "# ", "## ", "- ", "1. ", "> " at the beginning of a paragraph
  _autoformat() {
    const blk = this._blockEl(); if (!blk || blk.tagName !== 'P') return;
    const s = getSelection(); const r = s.getRangeAt(0); if (!r.collapsed) return;
    const before = blk.textContent.slice(0, this._offsetIn(blk));
    const m = /^(#{1,3}|-|\*|1\.|>)$/.exec(before); if (!m) return;
    const token = m[1]; const rest = blk.textContent.slice(token.length).replace(/^\s/, '');
    const apply = (tag) => { const n = document.createElement(tag); n.textContent = rest; if (!rest) n.innerHTML = '<br>'; blk.replaceWith(n); const nr = document.createRange(); nr.selectNodeContents(n); nr.collapse(false); s.removeAllRanges(); s.addRange(nr); };
    setTimeout(() => { // let the space land, then rewrite
      if (token === '#') apply('h2'); else if (token === '##') apply('h3'); else if (token === '###') apply('h4'); else if (token === '>') apply('blockquote');
      else { blk.textContent = rest; const nr = document.createRange(); nr.selectNodeContents(blk); nr.collapse(false); s.removeAllRanges(); s.addRange(nr); document.execCommand(token === '1.' ? 'insertOrderedList' : 'insertUnorderedList'); }
      this._changed();
    }, 0);
  }
  _offsetIn(el) { const s = getSelection(); const r = s.getRangeAt(0).cloneRange(); r.selectNodeContents(el); r.setEnd(s.getRangeAt(0).endContainer, s.getRangeAt(0).endOffset); return r.toString().length; }

  // ---- paste: keep structure, drop Word/Docs/website junk -----------------
  _paste(e) {
    const html = e.clipboardData?.getData('text/html'); const text = e.clipboardData?.getData('text/plain');
    if (!html && !text) return;
    e.preventDefault();
    let out;
    if (html) { const doc = new DOMParser().parseFromString(html, 'text/html'); out = cleanNode(doc.body); }
    else out = text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    document.execCommand('insertHTML', false, out); this._changed();
  }

  // ---- images: click → alt / alignment / remove -----------------------------
  _buildImagePopover() {
    const pop = document.createElement('div'); pop.className = 'rte-imgpop'; pop.hidden = true;
    pop.innerHTML = `<input class="rte-alt" placeholder="alt text"><button type="button" data-align="left" title="Float left">◧</button><button type="button" data-align="" title="Centered / full width">▣</button><button type="button" data-align="right" title="Float right">◨</button><button type="button" data-open title="Open">↗</button><button type="button" data-remove title="Remove image">✕</button>`;
    this.el.parentNode.insertBefore(pop, this.el.nextSibling); this.pop = pop;
    pop.querySelector('.rte-alt').oninput = (ev) => { if (this.img) { this.img.alt = ev.target.value; this._changed(); } };
    pop.querySelectorAll('[data-align]').forEach((b) => b.onclick = () => { if (!this.img) return; const f = this.img.closest('figure') || this.img; f.classList.remove('alignleft', 'alignright', 'aligncenter'); if (b.dataset.align) f.classList.add('align' + b.dataset.align); else f.classList.add('aligncenter'); this._changed(); });
    pop.querySelector('[data-open]').onclick = () => { if (this.img) window.open(this.img.currentSrc || this.img.src, '_blank', 'noopener'); };
    pop.querySelector('[data-remove]').onclick = () => { if (!this.img) return; (this.img.closest('figure') || this.img).remove(); this._hideImg(); this._changed(); };
  }
  _click(e) {
    const img = e.target.closest('img');
    if (!img || !this.el.contains(img)) { this._hideImg(); return; }
    this.img = img; this.el.querySelectorAll('img.rte-selected').forEach((i) => i.classList.remove('rte-selected')); img.classList.add('rte-selected');
    this.pop.querySelector('.rte-alt').value = img.alt || ''; this.pop.hidden = false;
  }
  _hideImg() { if (this.img) this.img.classList.remove('rte-selected'); this.img = null; if (this.pop) this.pop.hidden = true; }

  // ---- output --------------------------------------------------------------
  _changed() { this._refresh(); this.onChange?.(this.getHTML()); }
  _serialize() {
    const c = this.el.cloneNode(true);
    c.querySelectorAll('img.rte-selected').forEach((i) => i.classList.remove('rte-selected'));
    c.querySelectorAll('[class=""]').forEach((n) => n.removeAttribute('class'));
    // what execCommand emits → semantic tags; the archive's own markup is left alone
    c.querySelectorAll('b').forEach((n) => rename(n, 'strong')); c.querySelectorAll('i').forEach((n) => rename(n, 'em'));
    c.querySelectorAll('div:not([class]):not([id])').forEach((n) => { if (!n.querySelector('div,p,ul,ol,h1,h2,h3,h4,h5,h6,blockquote,pre,figure,table,iframe')) rename(n, 'p'); });
    c.querySelectorAll('span[style]').forEach((n) => { if (n.style.fontWeight === 'bold' || n.style.fontWeight >= 600) rename(n, 'strong'); else if (n.style.fontStyle === 'italic') rename(n, 'em'); else if (!n.getAttribute('style').replace(/;/g, '').trim()) n.replaceWith(...n.childNodes); });
    let html = c.innerHTML.replace(/​/g, '');
    html = html.replace(/(<p>(?:<br>|\s)*<\/p>\s*)+$/, ''); // trailing empty paragraphs
    return html;
  }
}

function rename(node, tag) { const n = document.createElement(tag); for (const a of node.attributes) n.setAttribute(a.name, a.value); while (node.firstChild) n.appendChild(node.firstChild); node.replaceWith(n); return n; }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
// Pasted HTML: keep semantic structure and attributes that matter, drop everything else
function cleanNode(node) {
  let out = '';
  for (const n of node.childNodes) {
    if (n.nodeType === 3) { out += esc(n.nodeValue); continue; }
    if (n.nodeType !== 1) continue;
    const tag = n.tagName.toLowerCase();
    if (['script', 'style', 'meta', 'link', 'head', 'title', 'o:p'].includes(tag)) continue;
    const inner = cleanNode(n);
    if (!KEEP_TAGS.has(tag)) { out += ['div', 'section', 'article', 'header', 'footer', 'main', 'aside'].includes(tag) && inner.trim() && !/^<(p|h\d|ul|ol|blockquote|pre|figure|table)/.test(inner.trim()) ? `<p>${inner}</p>` : inner; continue; }
    const t = tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag;
    const attrs = (KEEP_ATTRS[t] || []).map((a) => n.hasAttribute(a) ? ` ${a}="${esc(n.getAttribute(a))}"` : '').join('');
    if (t === 'a' && !n.getAttribute('href')) { out += inner; continue; }
    if (t === 'p' && !inner.trim()) continue;
    out += ['br', 'hr', 'img'].includes(t) ? `<${t}${attrs}>` : `<${t}${attrs}>${inner}</${t}>`;
  }
  return out;
}
