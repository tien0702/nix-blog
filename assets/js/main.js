/**
 * [NIX] Blog — main.js  (Markdown edition)
 *
 * Luồng load data:
 *   1. Fetch web-config.json     → site config, author, navigation, footer
 *   2. Fetch posts/index.json    → danh sách file *.md (auto-generated bởi GitHub Actions)
 *   3. Fetch từng posts/*.md     → parse frontmatter + markdown → post object
 *
 * id & slug = tên file (không có .md)
 * post-template.md bị bỏ qua tự động
 *
 * Thêm bài mới: tạo file .md trong posts/ → push → GitHub Actions tự cập nhật index.json
 */

'use strict';

// ── Config ────────────────────────────────────────────────────
const CFG  = { ...(window.SITE_CONFIG || {}) };
const BASE = (CFG.BASE_PATH || '').replace(/\/$/, '');

const URL_CONFIG = `${BASE}/${CFG.CONFIG_FILE || 'web-config.json'}`;
const URL_INDEX  = `${BASE}/posts/index.json`;
const URL_POST   = (file) => `${BASE}/posts/${file}`;

// ── State ─────────────────────────────────────────────────────
const state = {
  site:        {},
  author:      {},
  navigation:  [],
  footer:      {},
  posts:       [],   // parsed từ .md
  filtered:    [],
  activeTag:   'all',
  searchQuery: '',
  sortAsc:     false,
  currentPost: null,
};

// ─────────────────────────────────────────────────────────────
// FRONTMATTER PARSER
// Xử lý block --- ... --- ở đầu file .md
// Hỗ trợ: string, number, boolean, array dạng [a, b, c]
// ─────────────────────────────────────────────────────────────
function parseFrontmatter(raw) {
  const FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
  const match = raw.match(FENCE);

  if (!match) return { meta: {}, body: raw };

  const block = match[1];
  const body  = raw.slice(match[0].length);
  const meta  = {};

  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;

    const key   = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();

    if (!key) continue;

    // Array: [a, b, c]  hoặc  [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      meta[key] = value
        .slice(1, -1)
        .split(',')
        .map(v => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      continue;
    }

    // Boolean
    if (value === 'true')  { meta[key] = true;  continue; }
    if (value === 'false') { meta[key] = false; continue; }

    // Number
    if (value !== '' && !isNaN(value)) { meta[key] = Number(value); continue; }

    // String (bỏ dấu ngoặc nếu có)
    meta[key] = value.replace(/^["']|["']$/g, '');
  }

  return { meta, body };
}

// ─────────────────────────────────────────────────────────────
// MARKDOWN RENDERER (lightweight, không cần thư viện)
// Hỗ trợ: h1-h3, bold, italic, inline code, code block,
//         unordered list, ordered list, blockquote, paragraph,
//         link, horizontal rule
// ─────────────────────────────────────────────────────────────
function renderMarkdown(md) {
  // Normalize line endings
  let html = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // ── Code blocks (``` ... ```) — xử lý trước để tránh conflict
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = escHtml(code.trimEnd());
    const langAttr = lang ? ` data-lang="${escHtml(lang)}"` : '';
    return `<pre${langAttr}><code>${escaped}</code></pre>`;
  });

  // ── Inline code `...`
  html = html.replace(/`([^`\n]+)`/g, (_, code) => `<code>${escHtml(code)}</code>`);

  // ── Process line by line for block elements
  const lines  = html.split('\n');
  const output = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Already HTML (from code block replacement)
    if (line.startsWith('<pre') || line.startsWith('</pre')) {
      output.push(line);
      i++;
      continue;
    }

    // Headings
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h3) { output.push(`<h3>${inlineFormat(h3[1])}</h3>`); i++; continue; }
    if (h2) { output.push(`<h2>${inlineFormat(h2[1])}</h2>`); i++; continue; }
    if (h1) { output.push(`<h1>${inlineFormat(h1[1])}</h1>`); i++; continue; }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      output.push('<hr>'); i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const bqLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bqLines.push(lines[i].slice(2));
        i++;
      }
      output.push(`<blockquote>${inlineFormat(bqLines.join(' '))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*+] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        items.push(`<li>${inlineFormat(lines[i].replace(/^[-*+] /, ''))}</li>`);
        i++;
      }
      output.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${inlineFormat(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i++;
      }
      output.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Empty line → paragraph break (đã xử lý bên dưới)
    if (line.trim() === '') { output.push(''); i++; continue; }

    // Paragraph
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#')
           && !lines[i].startsWith('> ') && !/^[-*+] /.test(lines[i])
           && !/^\d+\. /.test(lines[i]) && !lines[i].startsWith('<')) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      output.push(`<p>${inlineFormat(paraLines.join(' '))}</p>`);
    }
  }

  return output.join('\n');
}

// Inline formatting: bold, italic, link
function inlineFormat(text) {
  // Bold+italic ***...***
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold **...**
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic *...* (không match **)
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Link [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return text;
}

// HTML escape (cho code blocks)
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Parse một file .md thành post object ─────────────────────
function parseMdFile(filename, rawText) {
  const { meta, body } = parseFrontmatter(rawText);

  const fileId = filename.replace(/\.md$/, '');

  return {
    // id & slug = tên file (không cần khai báo trong frontmatter)
    id:        fileId,
    slug:      fileId,
    title:     meta.title     || '(Chưa có tiêu đề)',
    date:      meta.date      ? String(meta.date) : '',
    tags:      Array.isArray(meta.tags) ? meta.tags : [],
    thumbnail: meta.thumbnail || '',
    summary:   meta.summary   || '',
    featured:  meta.featured  === true,
    draft:     meta.draft     === true,
    // Content: render markdown → HTML
    content:   renderMarkdown(body),
    // Giữ lại raw body nếu cần
    _filename: filename,
  };
}

// ─────────────────────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────────────────────
async function fetchConfig() {
  const res = await fetch(URL_CONFIG);
  if (!res.ok) throw new Error(`Không tải được data.json (HTTP ${res.status})`);
  return res.json();
}

async function fetchPostIndex() {
  const res = await fetch(URL_INDEX);
  if (!res.ok) throw new Error(`Không tải được posts/index.json (HTTP ${res.status})`);
  const list = await res.json();
  if (!Array.isArray(list)) throw new Error('posts/index.json phải là một mảng tên file.');
  // Bỏ qua post-template.md
  return list.filter(f => f !== 'post-template.md');
}

async function fetchPost(filename) {
  const res = await fetch(URL_POST(filename));
  if (!res.ok) {
    console.warn(`[NIX] Bỏ qua ${filename} — HTTP ${res.status}`);
    return null;
  }
  const text = await res.text();
  return parseMdFile(filename, text);
}

async function fetchAllPosts(fileList) {
  const results = await Promise.all(fileList.map(fetchPost));
  return results.filter(p => p !== null && !p.draft);
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// SITE CONFIG
// ─────────────────────────────────────────────────────────────
function applySiteConfig() {
  const { site, author } = state;

  if (site.name) document.title = `${site.name} — ${site.tagline || 'Blog'}`;

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && site.description) metaDesc.setAttribute('content', site.description);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme && site.themeColor) metaTheme.setAttribute('content', site.themeColor);

  if (site.language) document.documentElement.setAttribute('lang', site.language);

  const heroKicker  = document.getElementById('heroKicker');
  const heroHeading = document.getElementById('heroHeading');
  const heroSub     = document.getElementById('heroSub');

  if (heroKicker  && site.heroKicker)  heroKicker.textContent = site.heroKicker;
  if (heroHeading && site.heroHeading) heroHeading.innerHTML  = site.heroHeading;
  if (heroSub)                         heroSub.textContent    = site.heroSub || author.bio || '';

  const socialsEl = document.getElementById('heroSocials');
  if (socialsEl && author.socials?.length) {
    socialsEl.innerHTML = author.socials
      .map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener" class="social-link">${esc(s.label)}</a>`)
      .join('');
  }

  const footerCopy = document.getElementById('footerCopy');
  const footerLink = document.getElementById('footerLink');
  if (footerCopy && state.footer.copyright) footerCopy.textContent = state.footer.copyright;
  if (footerLink && state.footer.poweredBy) {
    footerLink.textContent = state.footer.poweredBy.label;
    footerLink.href        = state.footer.poweredBy.url;
  }
}

// ─────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────
function renderNavigation() {
  const nav = document.getElementById('headerNav');
  if (!nav || !state.navigation.length) return;

  nav.innerHTML = state.navigation.map(item => {
    const active = (item.action === 'home' && state.activeTag === 'all' && !state.currentPost)
      ? ' active' : '';
    return `<button class="nav-item${active}" data-action="${esc(item.action)}" data-tag="${esc(item.tag || '')}">${esc(item.label)}</button>`;
  }).join('');

  nav.addEventListener('click', e => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    const { action, tag } = btn.dataset;
    if (action === 'home') {
      state.activeTag = 'all';
      state.searchQuery = '';
      const si = document.getElementById('searchInput');
      if (si) si.value = '';
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
  document.getElementById('headerNav')?.querySelectorAll('.nav-item').forEach(btn => {
    const active = (btn.dataset.action === 'home' && state.activeTag === 'all' && !state.currentPost)
      || (btn.dataset.action === 'filter' && btn.dataset.tag === state.activeTag);
    btn.classList.toggle('active', active);
  });
}

function updateTagBtnActive() {
  document.getElementById('tagFilters')?.querySelectorAll('.tag-btn').forEach(b => {
    const active = b.dataset.tag === state.activeTag;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active);
  });
}

// ─────────────────────────────────────────────────────────────
// PIXEL GRID
// ─────────────────────────────────────────────────────────────
function initPixelGrid() {
  const grid = document.getElementById('pixelGrid');
  if (!grid) return;
  const colors = ['var(--accent)','var(--magenta)','var(--lime)',
    'rgba(255,255,255,0.06)','rgba(255,255,255,0.03)',
    'transparent','transparent','transparent'];
  for (let i = 0; i < 64; i++) {
    const cell = document.createElement('div');
    cell.className = 'pixel-cell';
    cell.style.background = colors[Math.floor(Math.random() * colors.length)];
    cell.style.animationDelay = `${Math.random() * 800}ms`;
    grid.appendChild(cell);
  }
  setInterval(() => {
    const cells = grid.querySelectorAll('.pixel-cell');
    cells[Math.floor(Math.random() * cells.length)].style.background =
      colors[Math.floor(Math.random() * colors.length)];
  }, 1200);
}

// ─────────────────────────────────────────────────────────────
// FILTER & SEARCH
// ─────────────────────────────────────────────────────────────
function applyFilters() {
  let result = [...state.posts];
  if (state.activeTag !== 'all')
    result = result.filter(p => Array.isArray(p.tags) && p.tags.includes(state.activeTag));
  const q = state.searchQuery.trim().toLowerCase();
  if (q)
    result = result.filter(p =>
      (p.title || '').toLowerCase().includes(q) || (p.summary || '').toLowerCase().includes(q));
  state.filtered = sortPosts(result, state.sortAsc);
  renderList();
}

// ─────────────────────────────────────────────────────────────
// RENDER: TAG FILTERS
// ─────────────────────────────────────────────────────────────
function renderTagFilters() {
  const wrap = document.getElementById('tagFilters');
  if (!wrap) return;
  wrap.innerHTML = collectTags(state.posts).map(tag => {
    const label = tag === 'all' ? 'Tất cả' : `#${tag}`;
    return `<button class="tag-btn${tag === state.activeTag ? ' active' : ''}" data-tag="${esc(tag)}" aria-pressed="${tag === state.activeTag}">${esc(label)}</button>`;
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

// ─────────────────────────────────────────────────────────────
// RENDER: CARD
// ─────────────────────────────────────────────────────────────
function createCard(post) {
  const article = document.createElement('article');
  article.className = `post-card${post.featured ? ' featured' : ''}`;
  article.setAttribute('role', 'button');
  article.setAttribute('tabindex', '0');
  article.setAttribute('aria-label', `Đọc: ${post.title}`);

  const tagsHtml = (post.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const thumbSrc = assetSrc(post.thumbnail);

  article.innerHTML = `
    ${thumbSrc ? `<div class="post-thumb" aria-hidden="true">
      <span class="thumb-placeholder">[&nbsp;]</span>
      <img src="${thumbSrc}" alt="${esc(post.title)}" loading="lazy">
    </div>` : ''}
    <div class="post-meta">
      <span class="post-date">${formatDate(post.date)}</span>
      ${post.featured ? '<span class="featured-badge">★ Featured</span>' : ''}
    </div>
    <h2 class="post-title">${esc(post.title)}</h2>
    <p class="post-summary">${esc(post.summary)}</p>
    ${tagsHtml ? `<div class="post-tags">${tagsHtml}</div>` : ''}
    <span class="read-more">Đọc tiếp</span>
  `;

  const img = article.querySelector('img');
  if (img) {
    img.addEventListener('load',  () => { img.classList.add('loaded'); article.querySelector('.thumb-placeholder')?.remove(); });
    img.addEventListener('error', () => img.closest('.post-thumb')?.remove());
  }

  const nav = () => navigateTo(post.id);
  article.addEventListener('click', nav);
  article.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav(); } });

  return article;
}

// ─────────────────────────────────────────────────────────────
// RENDER: LIST
// ─────────────────────────────────────────────────────────────
function renderList() {
  const listEl    = document.getElementById('postList');
  const countEl   = document.getElementById('postsCount');
  const featEl    = document.getElementById('featuredGrid');
  const featSecEl = document.getElementById('featuredSection');
  if (!listEl) return;

  if (countEl) {
    const t = state.posts.length, s = state.filtered.length;
    countEl.innerHTML = s === t ? `<strong>${t}</strong> bài viết` : `Đang hiển thị <strong>${s}</strong> / ${t} bài viết`;
  }

  if (featEl && featSecEl) {
    const noFilter = state.activeTag === 'all' && state.searchQuery === '';
    const featured = state.posts.filter(p => p.featured);
    if (noFilter && featured.length) {
      featSecEl.classList.remove('hidden');
      featEl.innerHTML = '';
      featured.forEach(p => featEl.appendChild(createCard(p)));
    } else {
      featSecEl.classList.add('hidden');
    }
  }

  listEl.innerHTML = '';
  if (!state.filtered.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">¯\\_(ツ)_/¯</div><p>Không tìm thấy bài viết nào.</p></div>`;
    return;
  }
  state.filtered.forEach(p => listEl.appendChild(createCard(p)));
}

// ─────────────────────────────────────────────────────────────
// RENDER: DETAIL
// ─────────────────────────────────────────────────────────────
function renderDetail(postId) {
  const post = state.posts.find(p => p.id === postId);
  if (!post) { navigateTo(null); return; }

  state.currentPost = post;
  document.title = `${post.title} — ${state.site.name || 'NIX'}`;

  document.getElementById('listView').style.display = 'none';
  const detailEl = document.getElementById('detailView');
  detailEl.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'instant' });

  const tagsHtml = (post.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const thumbSrc = assetSrc(post.thumbnail);
  const author   = state.author || {};
  const avatarSrc = assetSrc(author.avatar);
  const avatarInner = avatarSrc
    ? `<img src="${avatarSrc}" alt="${esc(author.name)}">`
    : esc((author.name || 'N')[0]);

  detailEl.innerHTML = `
    <div class="detail-topbar">
      <div class="container">
        <button class="back-btn" id="backBtn" aria-label="Quay lại">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Quay lại
        </button>
      </div>
    </div>
    <div class="detail-header">
      <p class="detail-kicker">${(post.tags || []).join(' · ') || 'Bài viết'}</p>
      <h1 class="detail-title">${esc(post.title)}</h1>
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
    ${thumbSrc ? `<div class="detail-thumb" id="detailThumb"><img src="${thumbSrc}" alt="${esc(post.title)}" loading="lazy"></div>` : ''}
    <div class="detail-content">${post.content}</div>
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

// ─────────────────────────────────────────────────────────────
// ROUTING
// ─────────────────────────────────────────────────────────────
function navigateTo(postId) {
  if (postId) {
    location.hash = postId;
  } else {
    history.pushState('', document.title, window.location.pathname + window.location.search);
    showListView();
  }
}

function showListView() {
  state.currentPost = null;
  document.title = `${state.site.name || 'NIX'} — ${state.site.tagline || 'Blog'}`;
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('listView').style.display   = 'block';
  window.scrollTo({ top: 0, behavior: 'instant' });
  updateNavActive();
}

function handleRoute() {
  const hash = location.hash.replace(/^#/, '').trim();
  if (hash && state.posts.length) renderDetail(hash);
  else if (!hash) showListView();
}

// ─────────────────────────────────────────────────────────────
// BIND CONTROLS
// ─────────────────────────────────────────────────────────────
function bindLogo() {
  document.getElementById('logoBtn')?.addEventListener('click', () => {
    state.activeTag = 'all';
    state.searchQuery = '';
    const si = document.getElementById('searchInput');
    if (si) si.value = '';
    navigateTo(null);
    updateNavActive();
    updateTagBtnActive();
    applyFilters();
  });
}

function bindSort() {
  const btn = document.getElementById('sortBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    state.sortAsc = !state.sortAsc;
    const icon = `<svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true"><path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    btn.innerHTML = `${icon} ${state.sortAsc ? 'Cũ nhất' : 'Mới nhất'}`;
    applyFilters();
  });
}

function bindSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  let timer;
  input.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.searchQuery = e.target.value; applyFilters(); }, 220);
  });
}

// ─────────────────────────────────────────────────────────────
// LOADING / ERROR
// ─────────────────────────────────────────────────────────────
function showLoading() {
  const el = document.getElementById('mainContent');
  if (el) el.innerHTML = `<div class="loading-wrap"><div class="loading-spinner" aria-hidden="true"></div><p class="loading-label">LOADING...</p></div>`;
}

function showError(msg) {
  const el = document.getElementById('mainContent');
  if (el) el.innerHTML = `<div class="container"><div class="error-wrap"><div class="error-code">ERR</div><p class="error-msg">${esc(msg)}</p><p class="error-hint">Mở DevTools → Console để xem chi tiết.</p></div></div>`;
}

function mountListLayout() {
  const el = document.getElementById('mainContent');
  if (!el) return;
  el.innerHTML = `
    <section id="featuredSection" class="featured-section hidden">
      <div class="container">
        <div class="section-label">Featured</div>
        <div id="featuredGrid" class="featured-grid"></div>
      </div>
    </section>
    <section class="posts-section">
      <div class="container">
        <div class="section-label">Tất cả bài viết</div>
        <p id="postsCount" class="posts-count"></p>
        <div id="postList" class="post-list"></div>
      </div>
    </section>`;
}

function updatePostCount() {
  const el = document.getElementById('postCountStatus');
  if (el) el.textContent = state.posts.length;
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
async function init() {
  showLoading();

  try {
    // 1. Load site config
    const config = await fetchConfig();
    state.site       = config.site       || {};
    state.author     = config.author     || {};
    state.navigation = config.navigation || [];
    state.footer     = config.footer     || {};

    // 2. Load danh sách file .md
    const fileList = await fetchPostIndex();

    // 3. Load & parse tất cả bài viết song song
    state.posts = await fetchAllPosts(fileList);

  } catch (err) {
    console.error('[NIX]', err);
    showError(err.message);
    return;
  }

  state.filtered = sortPosts(state.posts, state.sortAsc);

  applySiteConfig();
  mountListLayout();
  updatePostCount();
  renderNavigation();
  renderTagFilters();
  renderList();
  bindSearch();
  bindSort();
  bindLogo();
  initPixelGrid();

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

document.addEventListener('DOMContentLoaded', init);