// Category and tag pickers.
//
// TagPicker: chip UI. User types a tag name, hits Enter/Comma, a chip
// appears. Popular tags (from taxonomies) are offered as one-click
// additions.
//
// CategoryPicker: dropdown with optional parent hierarchy. Single
// selection per post (matches the Post Generator's existing behavior).
// Categories are loaded from taxonomies.categories.items.

import { slugify } from './slug.js';

export class TagPicker {
  // container: DOM element to render chips + input into
  // suggestions: { slug: { name, slug, count } } (from taxonomies.tags.items)
  // initial: starting array of { name, slug } objects
  constructor({ container, suggestions = {}, initial = [], onChange } = {}) {
    if (!container) throw new Error('TagPicker: container required');
    this.container = container;
    this.suggestions = suggestions;
    this.selected = Array.isArray(initial) ? initial.map(normalizeTag) : [];
    this.onChange = onChange || (() => {});
    this._render();
  }

  getTags() { return [...this.selected]; }

  setSuggestions(suggestions) {
    this.suggestions = suggestions || {};
    this._render();
  }

  addTag(tag) {
    const t = normalizeTag(tag);
    if (!t.slug) return;
    if (this.selected.some(s => s.slug === t.slug)) return;
    this.selected = [...this.selected, t];
    this._render();
    this.onChange(this.getTags());
  }

  removeTag(slug) {
    this.selected = this.selected.filter(s => s.slug !== slug);
    this._render();
    this.onChange(this.getTags());
  }

  _render() {
    this.container.innerHTML = '';
    const chips = document.createElement('div');
    chips.className = 'lic-tag-chips';
    chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px';
    for (const tag of this.selected) {
      const chip = document.createElement('span');
      chip.className = 'lic-tag-chip';
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:#e8f4f8;border:1px solid #b8dce8;border-radius:14px;font-size:0.85rem';
      chip.textContent = tag.name;
      const x = document.createElement('button');
      x.type = 'button';
      x.textContent = '×';
      x.style.cssText = 'background:none;border:none;color:#055;cursor:pointer;font-size:1rem;padding:0 0 0 2px';
      x.addEventListener('click', () => this.removeTag(tag.slug));
      chip.appendChild(x);
      chips.appendChild(chip);
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Add tag and press Enter…';
    input.className = 'lic-tag-input';
    input.style.cssText = 'width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-family:inherit';
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const value = input.value.trim();
        if (value) { this.addTag(value); input.value = ''; }
      }
    });
    input.addEventListener('blur', () => {
      const value = input.value.trim();
      if (value) { this.addTag(value); input.value = ''; }
    });
    this.container.appendChild(chips);
    this.container.appendChild(input);

    // Popular-tag panel
    const popular = Object.values(this.suggestions)
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 20)
      .filter(s => !this.selected.some(sel => sel.slug === s.slug));
    if (popular.length) {
      const panel = document.createElement('div');
      panel.style.cssText = 'margin-top:8px;font-size:0.82rem;color:#666';
      panel.innerHTML = '<div style="margin-bottom:4px">Popular tags (click to add):</div>';
      const list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
      for (const p of popular) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = `${p.name} (${p.count || 0})`;
        btn.style.cssText = 'background:#f5f5f5;border:1px solid #ddd;border-radius:3px;padding:2px 8px;font-size:0.78rem;cursor:pointer';
        btn.addEventListener('click', () => this.addTag(p));
        list.appendChild(btn);
      }
      panel.appendChild(list);
      this.container.appendChild(panel);
    }
  }
}

function normalizeTag(tag) {
  if (typeof tag === 'string') {
    return { name: tag.trim(), slug: slugify(tag) };
  }
  if (tag && typeof tag === 'object') {
    return {
      name: tag.name || tag.slug || '',
      slug: tag.slug || slugify(tag.name || ''),
    };
  }
  return { name: '', slug: '' };
}

export class CategoryPicker {
  // container: DOM element
  // categories: { slug: { name, slug, count, parent? } }  from taxonomies.categories.items
  // initial: { name, slug } | null
  constructor({ container, categories = {}, initial = null, onChange } = {}) {
    if (!container) throw new Error('CategoryPicker: container required');
    this.container = container;
    this.categories = categories;
    this.selected = initial ? { name: initial.name, slug: initial.slug } : null;
    this.onChange = onChange || (() => {});
    this._render();
  }

  getCategory() { return this.selected ? { ...this.selected } : null; }

  setCategories(categories) {
    this.categories = categories || {};
    this._render();
  }

  select(slug) {
    const cat = this.categories[slug];
    this.selected = cat ? { name: cat.name, slug: cat.slug, parent: cat.parent || null } : null;
    this._render();
    this.onChange(this.getCategory());
  }

  _render() {
    this.container.innerHTML = '';
    const select = document.createElement('select');
    select.className = 'lic-category-select';
    select.style.cssText = 'width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-family:inherit';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '— No category —';
    select.appendChild(noneOpt);

    const items = Object.values(this.categories).sort((a, b) => a.name.localeCompare(b.name));
    // Group by parent
    const roots = items.filter(c => !c.parent);
    const children = {};
    for (const c of items) {
      if (c.parent) {
        (children[c.parent] = children[c.parent] || []).push(c);
      }
    }
    const addOption = (cat, indent = 0) => {
      const opt = document.createElement('option');
      opt.value = cat.slug;
      opt.textContent = `${'— '.repeat(indent)}${cat.name}${cat.count != null ? ` (${cat.count})` : ''}`;
      if (this.selected && this.selected.slug === cat.slug) opt.selected = true;
      select.appendChild(opt);
      for (const ch of (children[cat.slug] || [])) addOption(ch, indent + 1);
    };
    for (const r of roots) addOption(r);

    select.addEventListener('change', () => this.select(select.value));
    this.container.appendChild(select);
  }
}
