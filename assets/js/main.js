/**
 * [NIX] Blog — main.js
 * Data-driven SPA blog cho GitHub Pages
 * Tất cả thông tin site, author, navigation, posts đều từ data.json
 */

'use strict';

// ── Config ────────────────────────────────────────────────────
const CFG = { ...(window.SITE_CONFIG || {}) };
const BASE = (CFG.BASE_PATH || '').replace(/\/$/, '');
const DATA_URL = `${BASE}/${CFG.DATA_FILE || 'data.json'}`;

// ── State ─────────────────────────────────────────────────────
const state = {
  site:        {},
  author:      {},
  navigation:  [],
  footer:      {},
  posts:       [],
  filtered:    [],
  activeTag:   'all',
  searchQuery: '',
  sortAsc:     false,
  currentPost: null,
};

let dataCache = null;

// ── Fetch ─────────────────────────────────────────────────────
async function fetchData() {
  if (dataCache) return dataCache;

  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Không tải được data (HTTP ${res.status})`);

  const json = await res.json();
  if (!json.posts || !Array.isArray(json.posts)) {
    throw new Error('data.json không hợp lệ — thiếu mảng "posts"');
  }

  dataCache = json;
  return dataCache;
}

// ── Helpers ───────────────────────────────────────────────────
function sortPosts(posts, asc = false) {
  return [...posts].sort((a, b) => {
    const da = new Date(a.date || 0);
    const db = new Date(b.date || 0);
    return asc ? da - db : db - da;
  });
}

function formatDate(str) {
  if (!str) return '';
  try {
    return new Date(str).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch { return str; }
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function assetSrc(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith('/')) return BASE + path;
  return path;
}

function collectTags(posts) {
  const s = new Set();
  posts.forEach(p => (p.tags || []).forEach(t => s.add(t)));
  return ['all', ...Array.from(s).sort()];
}

// ── Apply Site Config from data.json ─────────────────────────
function applySiteConfig() {
  const site = state.site;
  const author = state.author;

  // Document title & meta
  if (site.name) {
    document.title = `${site.name} — ${site.tagline || 'Blog'}`;
  }
  if (site.description) {
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', site.description);
  }
  if (site.themeColor) {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', site.themeColor);
  }
  if (site.language) {
    document.documentElement.setAttribute('lang', site.language);
  }

  // Hero section
  const heroKicker = document.getElementById('heroKicker');
  const heroHeading = document.getElementById('heroHeading');
  const heroSub = document.getElementById('heroSub');

  if (heroKicker && site.heroKicker) heroKicker.textContent = site.heroKicker;
  if (heroHeading && site.heroHeading) heroHeading.innerHTML = site.heroHeading;
  if (heroSub) {
    heroSub.textContent = site.heroSub || author.bio || '';
  }

  // Socials
  const socialsEl = document.getElementById('heroSocials');
  if (socialsEl && author.socials && author.socials.length > 0) {
    socialsEl.innerHTML = author.socials.map(s =>
      `<a href="${esc(s.url)}" target="_blank" rel="noopener" class="social-link">${esc(s.label)}</a>`
    ).join('');
  }

  // Footer
  const footerCopy = document.getElementById('footerCopy');
  const footerLink = document.getElementById('footerLink');
  if (footerCopy && state.footer.copyright) {
    footerCopy.textContent = state.footer.copyright;
  }
  if (footerLink && state.footer.poweredBy) {
    footerLink.textContent = state.footer.poweredBy.label;
    footerLink.href = state.footer.poweredBy.url;
  }
}

// ── Navigation ───────────────────────────────────────────────
function renderNavigation() {
  const nav = document.getElementById('headerNav');
  if (!nav || !state.navigation.length) return;

  nav.innerHTML = state.navigation.map((item, i) => {
    const activeClass = (item.action === 'home' && state.activeTag === 'all' && !state.currentPost) ? ' active' : '';
    return `<button class="nav-item${activeClass}" data-action="${esc(item.action)}" data-tag="${esc(item.tag || '')}">${esc(item.label)}</button>`;
  }).join('');

  nav.addEventListener('click', e => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;

    const action = btn.dataset.action;
    const tag = btn.dataset.tag;

    if (action === 'home') {
      state.activeTag = 'all';
      state.searchQuery = '';
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = '';
      navigateTo(null);
    } else if (action === 'filter' && tag) {
      state.activeTag = tag;
      navigateTo(null);
    }

    updateNavActive();
    applyFilters();
    updateTagBtnActive();
  });
}

function updateNavActive() {
  const nav = document.getElementById('headerNav');
  if (!nav) return;
  nav.querySelectorAll('.nav-item').forEach(btn => {
    const action = btn.dataset.action;
    const tag = btn.dataset.tag;
    let active = false;
    if (action === 'home' && state.activeTag === 'all') active = true;
    if (action === 'filter' && tag === state.activeTag) active = true;
    btn.classList.toggle('active', active);
  });
}

function updateTagBtnActive() {
  const wrap = document.getElementById('tagFilters');
  if (!wrap) return;
  wrap.querySelectorAll('.tag-btn').forEach(b => {
    const active = b.dataset.tag === state.activeTag;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active);
  });
}

// ── Pixel Grid Animation ─────────────────────────────────────
function initPixelGrid() {
  const grid = document.getElementById('pixelGrid');
  if (!grid) return;

  const colors = [
    'var(--accent)',
    'var(--magenta)',
    'var(--lime)',
    'rgba(255,255,255,0.06)',
    'rgba(255,255,255,0.03)',
    'transparent',
    'transparent',
    'transparent',
  ];

  for (let i = 0; i < 64; i++) {
    const cell = document.createElement('div');
    cell.className = 'pixel-cell';
    const color = colors[Math.floor(Math.random() * colors.length)];
    cell.style.background = color;
    cell.style.animationDelay = `${Math.random() * 800}ms`;
    grid.appendChild(cell);
  }

  // Subtle animation — random cells flicker
  setInterval(() => {
    const cells = grid.querySelectorAll('.pixel-cell');
    const idx = Math.floor(Math.random() * cells.length);
    const color = colors[Math.floor(Math.random() * colors.length)];
    cells[idx].style.background = color;
  }, 1200);
}

// ── Filter & Search ───────────────────────────────────────────
function applyFilters() {
  let result = [...state.posts];

  if (state.activeTag !== 'all') {
    result = result.filter(p =>
      Array.isArray(p.tags) && p.tags.includes(state.activeTag)
    );
  }

  const q = state.searchQuery.trim().toLowerCase();
  if (q) {
    result = result.filter(p =>
      (p.title  || '').toLowerCase().includes(q) ||
      (p.summary|| '').toLowerCase().includes(q)
    );
  }

  state.filtered = sortPosts(result, state.sortAsc);
  renderList();
}

// ── Render: Tag Filters ───────────────────────────────────────
function renderTagFilters() {
  const wrap = document.getElementById('tagFilters');
  if (!wrap) return;

  const tags = collectTags(state.posts);
  wrap.innerHTML = tags.map(tag => {
    const label = tag === 'all' ? 'Tất cả' : `#${tag}`;
    return `<button class="tag-btn${tag === state.activeTag ? ' active' : ''}"
              data-tag="${esc(tag)}"
              aria-pressed="${tag === state.activeTag}"
            >${esc(label)}</button>`;
  }).join('');

  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.tag-btn');
    if (!btn) return;
    state.activeTag = btn.dataset.tag;
    updateTagBtnActive();
    updateNavActive();
    applyFilters();
  });
}

// ── Render: Single Card ───────────────────────────────────────
function createCard(post) {
  const article = document.createElement('article');
  article.className = `post-card${post.featured ? ' featured' : ''}`;
  article.setAttribute('role', 'button');
  article.setAttribute('tabindex', '0');
  article.setAttribute('aria-label', `Đọc: ${post.title}`);

  const tagsHtml = (post.tags || [])
    .map(t => `<span class="tag">${esc(t)}</span>`)
    .join('');

  const thumbSrc = assetSrc(post.thumbnail);

  article.innerHTML = `
    ${thumbSrc ? `
    <div class="post-thumb" aria-hidden="true">
      <span class="thumb-placeholder">[&nbsp;]</span>
      <img src="${thumbSrc}" alt="${esc(post.title)}" loading="lazy">
    </div>` : ''}
    <div class="post-meta">
      <span class="post-date">${formatDate(post.date)}</span>
      ${post.featured ? '<span class="featured-badge">★ Featured</span>' : ''}
    </div>
    <h2 class="post-title">${esc(post.title || 'Chưa có tiêu đề')}</h2>
    <p class="post-summary">${esc(post.summary || '')}</p>
    ${tagsHtml ? `<div class="post-tags">${tagsHtml}</div>` : ''}
    <span class="read-more">Đọc tiếp</span>
  `;

  const img = article.querySelector('img');
  if (img) {
    img.addEventListener('load', () => {
      img.classList.add('loaded');
      const ph = article.querySelector('.thumb-placeholder');
      if (ph) ph.style.display = 'none';
    });
    img.addEventListener('error', () => img.closest('.post-thumb')?.remove());
  }

  const nav = () => navigateTo(post.id);
  article.addEventListener('click', nav);
  article.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav(); }
  });

  return article;
}

// ── Render: List View ─────────────────────────────────────────
function renderList() {
  const listEl     = document.getElementById('postList');
  const countEl    = document.getElementById('postsCount');
  const featuredEl = document.getElementById('featuredGrid');
  const featSecEl  = document.getElementById('featuredSection');

  if (!listEl) return;

  if (countEl) {
    const total   = state.posts.length;
    const showing = state.filtered.length;
    countEl.innerHTML = showing === total
      ? `<strong>${total}</strong> bài viết`
      : `Đang hiển thị <strong>${showing}</strong> / ${total} bài viết`;
  }

  if (featuredEl && featSecEl) {
    const noFilter = state.activeTag === 'all' && state.searchQuery === '';
    const featured  = state.posts.filter(p => p.featured);
    if (noFilter && featured.length > 0) {
      featSecEl.classList.remove('hidden');
      featuredEl.innerHTML = '';
      featured.forEach(p => featuredEl.appendChild(createCard(p)));
    } else {
      featSecEl.classList.add('hidden');
    }
  }

  listEl.innerHTML = '';
  if (state.filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">¯\\_(ツ)_/¯</div>
        <p>Không tìm thấy bài viết nào.</p>
      </div>`;
    return;
  }

  state.filtered.forEach(p => listEl.appendChild(createCard(p)));
}

// ── Render: Detail View ───────────────────────────────────────
function renderDetail(postId) {
  const post = state.posts.find(p => p.id === postId);
  if (!post) { console.warn('[NIX] Post not found:', postId); navigateTo(null); return; }

  state.currentPost = post;
  const siteName = state.site.name || 'NIX';
  const author = state.author || {};

  document.getElementById('listView').style.display  = 'none';
  const detailEl = document.getElementById('detailView');
  detailEl.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'instant' });

  document.title = `${post.title} — ${siteName}`;

  const tagsHtml = (post.tags || [])
    .map(t => `<span class="tag">${esc(t)}</span>`)
    .join('');

  const thumbSrc = assetSrc(post.thumbnail);

  // Author avatar
  const avatarSrc = assetSrc(author.avatar);
  const avatarInner = avatarSrc
    ? `<img src="${avatarSrc}" alt="${esc(author.name)}">`
    : esc((author.name || 'N')[0]);

  detailEl.innerHTML = `
    <div class="detail-topbar">
      <div class="container">
        <button class="back-btn" id="backBtn" aria-label="Quay lại danh sách">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Quay lại
        </button>
      </div>
    </div>

    <div class="detail-header">
      <p class="detail-kicker">${(post.tags || []).join(' · ') || 'Bài viết'}</p>
      <h1 class="detail-title">${esc(post.title || 'Chưa có tiêu đề')}</h1>
      <div class="detail-meta">
        <span class="detail-date">${formatDate(post.date)}</span>
        ${tagsHtml ? `<div class="detail-tags">${tagsHtml}</div>` : ''}
      </div>
      ${author.name ? `
      <div class="detail-author">
        <div class="detail-author-avatar">${avatarInner}</div>
        <div class="detail-author-info">
          <span class="detail-author-name">${esc(author.name)}</span>
          <span class="detail-author-role">Game Developer</span>
        </div>
      </div>` : ''}
    </div>

    ${thumbSrc ? `<div class="detail-thumb" id="detailThumb">
      <img src="${thumbSrc}" alt="${esc(post.title)}" loading="lazy">
    </div>` : ''}

    <div class="detail-content">
      ${post.content || '<p>Chưa có nội dung.</p>'}
    </div>
  `;

  const thumbWrap = document.getElementById('detailThumb');
  if (thumbWrap) {
    const img = thumbWrap.querySelector('img');
    img?.addEventListener('load',  () => thumbWrap.classList.add('loaded'));
    img?.addEventListener('error', () => thumbWrap.remove());
  }

  document.getElementById('backBtn')?.addEventListener('click', () => navigateTo(null));
  updateNavActive();
}

// ── Routing ───────────────────────────────────────────────────
function navigateTo(postId) {
  if (postId) {
    location.hash = postId;
  } else {
    history.pushState('', document.title,
      window.location.pathname + window.location.search);
    showListView();
  }
}

function showListView() {
  state.currentPost = null;
  const siteName = state.site.name || 'NIX';
  const tagline = state.site.tagline || 'Blog';
  document.title = `${siteName} — ${tagline}`;
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('listView').style.display   = 'block';
  window.scrollTo({ top: 0, behavior: 'instant' });
  updateNavActive();
}

function handleRoute() {
  const hash = location.hash.replace(/^#/, '').trim();
  if (hash && state.posts.length > 0) {
    renderDetail(hash);
  } else if (!hash) {
    showListView();
  }
}

// ── Status bar ────────────────────────────────────────────────
function updatePostCount() {
  const el = document.getElementById('postCountStatus');
  if (el) el.textContent = state.posts.length;
}

// ── Logo click → home ─────────────────────────────────────────
function bindLogo() {
  document.getElementById('logoBtn')?.addEventListener('click', () => {
    state.activeTag = 'all';
    state.searchQuery = '';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    navigateTo(null);
    updateNavActive();
    updateTagBtnActive();
    applyFilters();
  });
}

// ── Sort button ───────────────────────────────────────────────
function bindSort() {
  const btn = document.getElementById('sortBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    state.sortAsc = !state.sortAsc;
    btn.innerHTML = state.sortAsc
      ? `<svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
           <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
         </svg> Cũ nhất`
      : `<svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
           <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
         </svg> Mới nhất`;
    applyFilters();
  });
}

// ── Search ────────────────────────────────────────────────────
function bindSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  let timer;
  input.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.searchQuery = e.target.value;
      applyFilters();
    }, 220);
  });
}

// ── Show loading ──────────────────────────────────────────────
function showLoading() {
  const el = document.getElementById('mainContent');
  if (el) el.innerHTML = `
    <div class="loading-wrap">
      <div class="loading-spinner" aria-hidden="true"></div>
      <p class="loading-label">LOADING...</p>
    </div>`;
}

// ── Show error ────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('mainContent');
  if (el) el.innerHTML = `
    <div class="container">
      <div class="error-wrap">
        <div class="error-code">ERR</div>
        <p class="error-msg">${esc(msg)}</p>
        <p class="error-hint">Mở DevTools → Console để xem chi tiết.</p>
      </div>
    </div>`;
}

// ── Inject list layout ───────────────────────────────────────
function mountListLayout() {
  const el = document.getElementById('mainContent');
  if (!el) return;
  el.innerHTML = `
    <!-- Featured -->
    <section id="featuredSection" class="featured-section hidden">
      <div class="container">
        <div class="section-label">Featured</div>
        <div id="featuredGrid" class="featured-grid"></div>
      </div>
    </section>

    <!-- All posts -->
    <section class="posts-section">
      <div class="container">
        <div class="section-label">Tất cả bài viết</div>
        <p id="postsCount" class="posts-count"></p>
        <div id="postList" class="post-list"></div>
      </div>
    </section>
  `;
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  showLoading();

  try {
    const data = await fetchData();

    // Extract config sections
    state.site       = data.site || {};
    state.author     = data.author || {};
    state.navigation = data.navigation || [];
    state.footer     = data.footer || {};
    state.posts      = (data.posts || []).filter(p => !p.draft);

  } catch (err) {
    console.error('[NIX] fetchData error:', err);
    showError('Không thể tải data.json. ' + err.message);
    return;
  }

  state.filtered = sortPosts(state.posts, state.sortAsc);

  // Apply site config from data.json
  applySiteConfig();

  // Mount layout
  mountListLayout();

  // Bind controls
  updatePostCount();
  renderNavigation();
  renderTagFilters();
  renderList();
  bindSearch();
  bindSort();
  bindLogo();

  // Pixel grid animation
  initPixelGrid();

  // Hash routing
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
