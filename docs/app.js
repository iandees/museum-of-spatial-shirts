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

const CATEGORY_PLACEHOLDER = {
  event:   '🗺️',
  concept: '🌏',
  company: '🏢',
};

let allItems = [];
let activeCategory = 'all';
let activeTags = new Set();
let searchQuery = '';

// Current lightbox state
let lightboxPhotos = [];
let lightboxIndex = 0;

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
}

// ---- Stats ----
function renderStats() {
  const totalPhotos = allItems.reduce((n, i) => n + (i.photos?.length || 0), 0);
  const eventCount = allItems.filter(i => i.category === 'event').length;
  const storyCount = allItems.reduce((n, i) => n + (i.stories?.length || 0), 0);

  document.getElementById('hero-stats').innerHTML = `
    <div class="stat">
      <span class="stat-number">${allItems.length}</span>
      <span class="stat-label">Items</span>
    </div>
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
    // Category filter
    if (activeCategory === 'wanted') {
      if ((item.photos?.length || 0) > 0) return false;
    } else if (activeCategory !== 'all' && item.category !== activeCategory) return false;

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
    const icon = CATEGORY_PLACEHOLDER[item.category] || '👕';

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

    return `
      <article class="card ${wanted ? 'card-wanted' : ''}" data-id="${item.id}" role="button" tabindex="0" aria-label="Open ${escHtml(item.name)}">
        <div class="card-thumb">
          ${thumbHtml}
          ${photoCountBadge}
        </div>
        <div class="card-body">
          <span class="card-category ${catClass}">${CATEGORY_ICONS[item.category] || ''} ${CATEGORY_LABELS[item.category] || item.category}</span>
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
  const item = allItems.find(i => i.id === id);
  if (!item) return;

  const panel = document.getElementById('detail-panel');
  const inner = document.getElementById('detail-inner');

  const catClass = `cat-${item.category}`;
  const yearStr = item.yearRange || (item.year ? item.year : '');
  const metaParts = [];
  if (yearStr) metaParts.push(String(yearStr));
  if (item.location) metaParts.push(item.location);

  const photosHtml = item.photos?.length
    ? `<div>
        <div class="detail-section-title">Photos (${item.photos.length})</div>
        <div class="detail-photos">
          ${item.photos.map((p, i) => `
            <div class="detail-photo-thumb" data-photo-index="${i}" data-item-id="${id}">
              <img src="images/thumb/${p.file}" alt="${escHtml(p.caption || item.name)}" loading="lazy" />
            </div>
          `).join('')}
        </div>
      </div>`
    : `<div>
        <div class="detail-section-title">Photos</div>
        <a class="story-add-link"
           href="https://github.com/iandees/museum-of-spatial-shirts/issues/new?template=add-shirt.md&title=Photo+for%3A+${encodeURIComponent(item.name)}"
           target="_blank" rel="noopener">
          📷 Do you have a photo of this shirt? Contribute one!
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

  const tagsHtml = (item.tags || []).map(t =>
    `<span class="detail-tag">${escHtml(t)}</span>`
  ).join('');

  inner.innerHTML = `
    <button class="detail-close" id="detail-close-btn">← Back</button>
    <div>
      <span class="detail-category ${catClass}">${CATEGORY_ICONS[item.category] || ''} ${CATEGORY_LABELS[item.category] || item.category}</span>
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
    ${storiesHtml}
    ${tagsHtml ? `<div class="detail-tags">${tagsHtml}</div>` : ''}
  `;

  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');

  // Bind photo thumbs → lightbox
  inner.querySelectorAll('.detail-photo-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const idx = parseInt(thumb.dataset.photoIndex, 10);
      openLightbox(item.photos, idx);
    });
  });

  // Close button
  inner.querySelector('#detail-close-btn').addEventListener('click', closeDetail);
}

function closeDetail() {
  const panel = document.getElementById('detail-panel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
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
    ${photo.caption ? `<div class="lightbox-caption">${escHtml(photo.caption)}${photo.credit ? ` — ${escHtml(photo.credit)}` : ''}</div>` : ''}
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
  // Category nav
  document.querySelectorAll('.nav-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.filter;
      document.querySelectorAll('.nav-btn[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid();
    });
  });

  // Search
  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    renderGrid();
  });

  // Detail overlay close
  document.getElementById('detail-overlay').addEventListener('click', closeDetail);

  // Lightbox
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

  // Keyboard
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
