/* ============================================================
   Museum of Spatial Shirts — App Logic
   ============================================================ */

const CATEGORY_ICONS = {
  event:   '📅',
  concept: '🌐',
  company: '🏢',
};

const CATEGORY_LABELS = {
  event:   'Event',
  concept: 'Concept',
  company: 'Company',
};

const TYPE_ICONS = {
  shirt:   '👕',
  sticker: '✨',
  hoodie:  '🧥',
  hat:     '🧢',
  patch:   '🪡',
  other:   '📦',
};

const TYPE_LABELS = {
  shirt:   'Shirt',
  sticker: 'Sticker',
  hoodie:  'Hoodie',
  hat:     'Hat',
  patch:   'Patch',
  other:   'Other',
};

const TYPE_PLACEHOLDER = {
  shirt:   '👕',
  sticker: '✨',
  hoodie:  '🧥',
  hat:     '🧢',
  patch:   '🪡',
  other:   '📦',
};

let allItems = [];
let activeCategory = 'all';  // 'all' | 'shirt' | 'sticker' | ... | 'wanted'
let activeTags = new Set();
let searchQuery = '';

// Current lightbox state
let lightboxPhotos = [];
let lightboxIndex = 0;

// ---- Hash routing ----
// Format:
//   #sotm-us-2015                     (item only, backward-compat)
//   #filter=shirts                     (filter only)
//   #filter=shirts&item=sotm-us-2015   (filter + item)

function parseHash() {
  const raw = window.location.hash.slice(1);
  if (!raw) return { filter: null, item: null };
  // Backward-compat: plain item ID (no '=' in string)
  if (!raw.includes('=')) return { filter: null, item: raw };
  const params = new URLSearchParams(raw);
  return {
    filter: params.get('filter') || null,
    item:   params.get('item')   || null,
  };
}

function buildHash({ filter, item }) {
  const f = filter && filter !== 'all' ? filter : null;
  if (!f && !item) return '';
  if (!f && item)  return item;   // plain #item-id for clean item-only links
  const p = new URLSearchParams();
  if (f)    p.set('filter', f);
  if (item) p.set('item', item);
  return p.toString();
}

function pushHash(state, { replace = false } = {}) {
  const hash = buildHash(state);
  const url = hash ? `#${hash}` : window.location.pathname;
  if (replace) history.replaceState(null, '', url);
  else         history.pushState(null, '', url);
}

function applyHash({ filter, item }, { updateUI = true } = {}) {
  // Apply filter
  if (filter && filter !== activeCategory) {
    activeCategory = filter;
    if (updateUI) {
      document.querySelectorAll('.nav-btn[data-filter]').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === filter);
      });
      renderGrid();
    }
  }
  // Open item
  if (item && allItems.find(i => i.id === item)) {
    openDetailSilent(item);
  }
}

// ---- Bootstrap ----
async function init() {
  try {
    const res = await fetch('collection.json');
    const data = await res.json();
    allItems = data.items || [];
  } catch (e) {
    console.error('Failed to load collection.json', e);
    allItems = [];
  }

  renderStats();
  renderTagFilters();
  renderGrid();
  bindEvents();

  // Restore state from URL hash on load
  if (window.location.hash) applyHash(parseHash());
}

// ---- Stats ----
function renderStats() {
  const totalPhotos = allItems.reduce((n, i) => n + (i.photos?.length || 0), 0);
  const storyCount = allItems.reduce((n, i) => n + (i.stories?.length || 0), 0);
  const shirtCount = allItems.filter(i => i.type === 'shirt').length;
  const stickerCount = allItems.filter(i => i.type === 'sticker').length;

  document.getElementById('hero-stats').innerHTML = `
    <div class="stat">
      <span class="stat-number">${shirtCount}</span>
      <span class="stat-label">Shirts</span>
    </div>
    ${stickerCount > 0 ? `
    <div class="stat">
      <span class="stat-number">${stickerCount}</span>
      <span class="stat-label">Stickers</span>
    </div>` : ''}
    <div class="stat">
      <span class="stat-number">${totalPhotos}</span>
      <span class="stat-label">Photos</span>
    </div>
    <div class="stat">
      <span class="stat-number">${storyCount}</span>
      <span class="stat-label">Stories</span>
    </div>
  `;
}

// ---- Tag filters ----
function getAllTags() {
  const tagSet = new Set();
  allItems.forEach(item => (item.tags || []).forEach(t => tagSet.add(t)));
  return [...tagSet].sort();
}

function renderTagFilters() {
  const tags = getAllTags();
  const container = document.getElementById('tag-filters');
  container.innerHTML = tags.map(t => `
    <button class="tag-pill ${activeTags.has(t) ? 'active' : ''}" data-tag="${t}">${t}</button>
  `).join('');

  container.querySelectorAll('.tag-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      if (activeTags.has(tag)) activeTags.delete(tag);
      else activeTags.add(tag);
      renderTagFilters();
      renderGrid();
    });
  });
}

// ---- Filtering ----
function getFilteredItems() {
  return allItems.filter(item => {
    if (activeCategory === 'wanted') {
      if ((item.photos?.length || 0) > 0) return false;
    } else if (activeCategory !== 'all') {
      // Filter by type (shirt, sticker, etc.)
      if (item.type !== activeCategory) return false;
    }

    // Tag filter
    if (activeTags.size > 0) {
      const itemTags = new Set(item.tags || []);
      for (const t of activeTags) {
        if (!itemTags.has(t)) return false;
      }
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const haystack = [
        item.name,
        item.description,
        item.location,
        item.type,
        ...(item.tags || []),
        ...(item.stories || []).map(s => s.text + ' ' + s.author),
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

// ---- Grid rendering ----
function renderGrid() {
  const items = getFilteredItems();
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('empty-state');

  if (items.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  grid.innerHTML = items.map(item => {
    const firstPhoto = item.photos?.[0];
    const photoCount = item.photos?.length || 0;
    const storyCount = item.stories?.length || 0;
    const wanted = photoCount === 0;
    const catClass = `cat-${item.category}`;
    const icon = TYPE_PLACEHOLDER[item.type] || TYPE_PLACEHOLDER.other;

    const thumbHtml = firstPhoto
      ? `<img src="images/thumb/${firstPhoto.file}" alt="${escHtml(item.name)}" loading="lazy" />`
      : `<div class="card-thumb-placeholder card-thumb-wanted">${icon}<span class="wanted-label">Photo wanted</span></div>`;

    const photoCountBadge = photoCount > 1
      ? `<span class="card-photo-count">📷 ${photoCount}</span>`
      : '';

    const yearStr = item.yearRange || (item.year ? item.year : '');
    const metaParts = [];
    if (yearStr) metaParts.push(String(yearStr));
    if (item.location) metaParts.push(item.location);

    const tagsHtml = (item.tags || []).slice(0, 4).map(t =>
      `<span class="card-tag">${escHtml(t)}</span>`
    ).join('');

    const storiesBadge = storyCount > 0
      ? `<div class="card-stories-badge">💬 ${storyCount} ${storyCount === 1 ? 'story' : 'stories'}</div>`
      : '';

    // Badge: category + type
    const typeLabel = TYPE_ICONS[item.type]
      ? `<span class="card-type-dot">·</span><span class="card-type">${TYPE_ICONS[item.type]} ${TYPE_LABELS[item.type] || item.type}</span>`
      : '';

    return `
      <article class="card ${wanted ? 'card-wanted' : ''}" data-id="${item.id}" role="button" tabindex="0" aria-label="Open ${escHtml(item.name)}">
        <div class="card-thumb">
          ${thumbHtml}
          ${photoCountBadge}
        </div>
        <div class="card-body">
          <div class="card-badge-row">
            <span class="card-category ${catClass}">${CATEGORY_ICONS[item.category] || ''} ${CATEGORY_LABELS[item.category] || item.category}</span>
            ${item.type ? `<span class="card-type-badge">${TYPE_ICONS[item.type] || ''} ${TYPE_LABELS[item.type] || item.type}</span>` : ''}
          </div>
          <h2 class="card-title">${escHtml(item.name)}</h2>
          ${metaParts.length ? `<div class="card-year">${escHtml(metaParts.join(' · '))}</div>` : ''}
          <p class="card-desc">${escHtml(item.description || '')}</p>
          <div class="card-tags">${tagsHtml}</div>
          ${storiesBadge}
        </div>
      </article>
    `;
  }).join('');

  // Card click → detail panel
  grid.querySelectorAll('.card').forEach(card => {
    const id = card.dataset.id;
    const handler = () => openDetail(id);
    card.addEventListener('click', handler);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') handler(); });
  });
}

// ---- Detail panel ----
function openDetail(id) {
  pushHash({ filter: activeCategory, item: id });
  openDetailSilent(id);
}

function openDetailSilent(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;

  const panel = document.getElementById('detail-panel');
  const inner = document.getElementById('detail-inner');

  const catClass = `cat-${item.category}`;
  const yearStr = item.yearRange || (item.year ? item.year : '');

  const photosHtml = item.photos?.length
    ? `<div>
        <div class="detail-section-title">Photos (${item.photos.length})</div>
        <div class="detail-photos">
          ${item.photos.map((p, i) => `
            <div class="detail-photo-wrap">
              <div class="detail-photo-thumb" data-photo-index="${i}" data-item-id="${id}">
                <img src="images/thumb/${p.file}" alt="${escHtml(p.caption || item.name)}" loading="lazy" />
              </div>
              ${p.credit ? `<div class="detail-photo-credit">Photo by ${escHtml(p.credit)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`
    : `<div>
        <div class="detail-section-title">Photos</div>
        <a class="story-add-link"
           href="https://github.com/iandees/museum-of-spatial-shirts/issues/new?template=add-shirt.md&title=Photo+for%3A+${encodeURIComponent(item.name)}"
           target="_blank" rel="noopener">
          📷 Do you have a photo of this item? Contribute one!
        </a>
      </div>`;

  const storiesHtml = `
    <div>
      <div class="detail-section-title">Stories</div>
      ${(item.stories || []).map(s => `
        <div class="story-card" style="margin-bottom:0.6rem">
          <div class="story-author">${escHtml(s.author || 'Anonymous')}</div>
          ${escHtml(s.text)}
        </div>
      `).join('')}
      <a class="story-add-link"
         href="https://github.com/iandees/museum-of-spatial-shirts/issues/new?template=add-story.md&title=Story+for%3A+${encodeURIComponent(item.name)}"
         target="_blank" rel="noopener">
        + Add a story about this item
      </a>
    </div>
  `;

  // Related items — same event, different type
  const related = item.event
    ? allItems.filter(i => i.id !== item.id && i.event === item.event)
    : [];

  const relatedHtml = related.length
    ? `<div>
        <div class="detail-section-title">Also from this event</div>
        <div class="related-list">
          ${related.map(r => `
            <button class="related-item" data-id="${r.id}">
              ${r.photos?.[0]
                ? `<img src="images/thumb/${r.photos[0].file}" alt="${escHtml(r.name)}" />`
                : `<div class="related-placeholder">${TYPE_PLACEHOLDER[r.type] || '📦'}</div>`
              }
              <span>${TYPE_ICONS[r.type] || ''} ${TYPE_LABELS[r.type] || r.type}</span>
            </button>
          `).join('')}
        </div>
      </div>`
    : '';

  const tagsHtml = (item.tags || []).map(t =>
    `<span class="detail-tag">${escHtml(t)}</span>`
  ).join('');

  inner.innerHTML = `
    <div class="detail-top-row">
      <button class="detail-close" id="detail-close-btn">← Back</button>
      <button class="detail-share" id="detail-share-btn" title="Copy link">🔗 Copy link</button>
    </div>
    <div class="card-badge-row">
      <span class="detail-category ${catClass}">${CATEGORY_ICONS[item.category] || ''} ${CATEGORY_LABELS[item.category] || item.category}</span>
      ${item.type ? `<span class="card-type-badge">${TYPE_ICONS[item.type] || ''} ${TYPE_LABELS[item.type] || item.type}</span>` : ''}
    </div>
    <h2 class="detail-title">${escHtml(item.name)}</h2>
    <div class="detail-meta">
      ${yearStr ? `<span>📅 ${escHtml(String(yearStr))}</span>` : ''}
      ${item.location ? `<span>📍 ${escHtml(item.location)}</span>` : ''}
      ${item.designer ? `<span>✏️ Designed by ${escHtml(item.designer)}</span>` : ''}
      ${item.url ? `<span><a href="${escHtml(item.url)}" target="_blank" rel="noopener">🔗 Event site</a></span>` : ''}
    </div>
    <p class="detail-description">${escHtml(item.description || '')}</p>
    ${photosHtml}
    ${relatedHtml}
    ${storiesHtml}
    ${tagsHtml ? `<div class="detail-tags">${tagsHtml}</div>` : ''}
  `;

  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');

  // Photo thumbs → lightbox
  inner.querySelectorAll('.detail-photo-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const idx = parseInt(thumb.dataset.photoIndex, 10);
      openLightbox(item.photos, idx);
    });
  });

  // Related item buttons → open that item
  inner.querySelectorAll('.related-item').forEach(btn => {
    btn.addEventListener('click', () => openDetail(btn.dataset.id));
  });

  inner.querySelector('#detail-close-btn').addEventListener('click', closeDetail);

  // Share / copy link button
  inner.querySelector('#detail-share-btn').addEventListener('click', async (e) => {
    const hash = buildHash({ filter: activeCategory, item: id });
    const url = `${location.origin}${location.pathname}#${hash}`;
    await navigator.clipboard.writeText(url);
    const btn = e.currentTarget;
    btn.textContent = '✓ Copied!';
    setTimeout(() => btn.textContent = '🔗 Copy link', 2000);
  });
}

function closeDetail() {
  const panel = document.getElementById('detail-panel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  // Keep filter in hash but drop item
  pushHash({ filter: activeCategory });
}

// ---- Lightbox ----
function openLightbox(photos, index) {
  lightboxPhotos = photos;
  lightboxIndex = index;
  renderLightboxFrame();
  document.getElementById('lightbox').classList.add('open');
  document.getElementById('lightbox').setAttribute('aria-hidden', 'false');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lightbox').setAttribute('aria-hidden', 'true');
}

function renderLightboxFrame() {
  const photo = lightboxPhotos[lightboxIndex];
  const content = document.getElementById('lightbox-content');
  content.innerHTML = `
    <img src="images/medium/${photo.file}" alt="${escHtml(photo.caption || '')}" />
    ${photo.caption ? `<div class="lightbox-caption">${escHtml(photo.caption)}${photo.credit ? ` — photo by ${escHtml(photo.credit)}` : ''}</div>` : ''}
    <div class="lightbox-caption" style="opacity:0.4">
      ${lightboxIndex + 1} / ${lightboxPhotos.length}
      &nbsp;&middot;&nbsp;
      <a href="images/${photo.file}" target="_blank" rel="noopener" style="color:inherit">full resolution ↗</a>
    </div>
  `;

  document.getElementById('lightbox-prev').style.display = lightboxPhotos.length > 1 ? '' : 'none';
  document.getElementById('lightbox-next').style.display = lightboxPhotos.length > 1 ? '' : 'none';
}

// ---- Event bindings ----
function bindEvents() {
  document.querySelectorAll('.nav-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.filter;
      document.querySelectorAll('.nav-btn[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid();
      // Close any open detail panel and update hash
      const panel = document.getElementById('detail-panel');
      if (panel.classList.contains('open')) {
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
      }
      pushHash({ filter: activeCategory });
    });
  });

  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    renderGrid();
  });

  document.getElementById('detail-overlay').addEventListener('click', closeDetail);

  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target === document.getElementById('lightbox')) closeLightbox();
  });

  document.getElementById('lightbox-prev').addEventListener('click', () => {
    lightboxIndex = (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
    renderLightboxFrame();
  });

  document.getElementById('lightbox-next').addEventListener('click', () => {
    lightboxIndex = (lightboxIndex + 1) % lightboxPhotos.length;
    renderLightboxFrame();
  });

  document.addEventListener('keydown', e => {
    const lightbox = document.getElementById('lightbox');
    const detail = document.getElementById('detail-panel');

    if (lightbox.classList.contains('open')) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') {
        lightboxIndex = (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
        renderLightboxFrame();
      }
      if (e.key === 'ArrowRight') {
        lightboxIndex = (lightboxIndex + 1) % lightboxPhotos.length;
        renderLightboxFrame();
      }
    } else if (detail.classList.contains('open')) {
      if (e.key === 'Escape') closeDetail();
    }
  });
  // Browser back/forward
  window.addEventListener('popstate', () => {
    const { filter, item } = parseHash();
    // Reset to 'all' if no filter in hash
    const newFilter = filter || 'all';
    if (newFilter !== activeCategory) {
      activeCategory = newFilter;
      document.querySelectorAll('.nav-btn[data-filter]').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === newFilter);
      });
      renderGrid();
    }
    // Open or close item
    const panel = document.getElementById('detail-panel');
    if (item && allItems.find(i => i.id === item)) {
      openDetailSilent(item);
    } else if (panel.classList.contains('open')) {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    }
  });
}

// ---- Util ----
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Go ----
document.addEventListener('DOMContentLoaded', init);
