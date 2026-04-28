/**
 * [NIX] Blog — main.js  (Single Google Doc, multi-tab edition)
 *
 * Config:  web-config.json  →  field "gdoc_url" chứa link publish của Google Doc
 *
 * Cấu trúc Google Doc:
 *   • Mỗi Document Tab = 1 bài viết, tên tab = slug/id
 *   • Tab tên "post-template" bị bỏ qua tự động
 *   • Trong mỗi tab:
 *       [Dòng 1 — Heading 1]  →  title
 *       ---                   →  separator
 *       slug: ...
 *       date: ...
 *       tags: tag1, tag2
 *       summary: ...
 *       featured: true/false
 *       draft: true/false
 *       thumbnail: (URL hoặc để trống)
 *       ---                   →  separator
 *       [Nội dung bài viết]
 *
 * Luồng:
 *   1. Fetch web-config.json → lấy gdoc_url + site config
 *   2. Fetch gdoc_url qua CORS proxy → nhận HTML published doc
 *   3. Parse danh sách tabs từ navigation trong HTML
 *   4. Với mỗi tab (trừ post-template): fetch ?tab=tabId → parse post
 *   5. Render blog
 */

'use strict';

// ── Config ────────────────────────────────────────────────────
const CFG      = { ...(window.SITE_CONFIG || {}) };
const BASE     = (CFG.BASE_PATH || '').replace(/\/$/, '');
const URL_CFG  = `${BASE}/${CFG.CONFIG_FILE || 'web-config.json'}`;

// CORS proxies — thử lần lượt nếu proxy trước thất bại
const PROXIES = [
  {
    build: (url) => `https://shy-firefly-53f5.tientv-0702.workers.dev//?url=${encodeURIComponent(url)}`,
    extract: async (res) => res.text(),
  },
];

// Cache từng tab đã fetch
const tabCache = new Map();

// ── State ─────────────────────────────────────────────────────
const state = {
  site:        {},
  author:      {},
  navigation:  [],
  footer:      {},
  gdocUrl:     '',
  posts:       [],
  filtered:    [],
  activeTag:   'all',
  searchQuery: '',
  sortAsc:     false,
  currentPost: null,
};

// ─────────────────────────────────────────────────────────────
// FETCH HELPERS
// ─────────────────────────────────────────────────────────────
async function fetchViaProxy(url) {
  let lastErr;
  for (const px of PROXIES) {
    try {
      const res = await fetch(px.build(url));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const content = await px.extract(res);
      if (!content) throw new Error('Empty response');
      return content;
    } catch (err) {
      console.warn('[NIX] Proxy thất bại, thử tiếp...', err.message);
      lastErr = err;
    }
  }
  throw new Error('Tất cả proxy đều thất bại: ' + (lastErr?.message || ''));
}

function parseDOM(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

// ─────────────────────────────────────────────────────────────
// BƯỚC 1 — FETCH DANH SÁCH TABS
// Google Docs /pub HTML có navigation tabs dạng:
//   <ul class="nav-bar-list">
//     <li><a href="...pub?tab=t.0" ...>tab-name</a></li>
// Nếu Doc chỉ có 1 tab, không có nav → coi như 1 tab duy nhất
// ─────────────────────────────────────────────────────────────
async function fetchTabList(gdocUrl) {
  const html = await fetchViaProxy(gdocUrl);
  const doc  = parseDOM(html);

  const tabs = [];

  // Thử parse navigation tabs (multi-tab doc)
  // Google Docs published: các tab nằm trong heading nav hoặc dạng link với ?tab=t.X
  const tabLinks = doc.querySelectorAll(
    'a[href*="?tab="], a[href*="&tab="], [role="tab"], .tab-link'
  );

  if (tabLinks.length > 0) {
    tabLinks.forEach(link => {
      const href    = link.getAttribute('href') || '';
      const name    = link.textContent.trim();
      // Extract tab param: ?tab=t.abc123  hoặc  #heading=t.abc123
      const tabMatch = href.match(/[?&]tab=([^&#]+)/);
      const tabId    = tabMatch ? tabMatch[1] : null;
      if (tabId && name) tabs.push({ name, tabId, url: resolveTabUrl(gdocUrl, tabId) });
    });
  }

  // Fallback: Google Docs đôi khi render tabs dạng khác — tìm kiếm rộng hơn
  if (tabs.length === 0) {
    // Tìm tất cả links có pattern /pub?tab=
    const allLinks = doc.querySelectorAll('a[href]');
    allLinks.forEach(link => {
      const href = link.getAttribute('href') || '';
      if (href.includes('tab=')) {
        const tabMatch = href.match(/[?&]tab=([^&#\s]+)/);
        const name     = link.textContent.trim();
        const tabId    = tabMatch ? tabMatch[1] : null;
        if (tabId && name && !tabs.find(t => t.tabId === tabId)) {
          tabs.push({ name, tabId, url: resolveTabUrl(gdocUrl, tabId) });
        }
      }
    });
  }

  // Nếu vẫn không tìm thấy tab nav → doc chỉ có 1 tab, parse thẳng từ HTML gốc
  if (tabs.length === 0) {
    return [{ name: '__single__', tabId: null, html }];
  }

  // Lọc bỏ tab "post-template"
  return tabs.filter(t => t.name.toLowerCase() !== 'post-template');
}

function resolveTabUrl(baseUrl, tabId) {
  // baseUrl: https://docs.google.com/document/d/ID/pub
  // output:  https://docs.google.com/document/d/ID/pub?tab=tabId
  const url = new URL(baseUrl);
  url.searchParams.set('tab', tabId);
  return url.toString();
}

// ─────────────────────────────────────────────────────────────
// BƯỚC 2 — FETCH & PARSE MỖI TAB
// ─────────────────────────────────────────────────────────────
async function fetchTab(tabInfo) {
  const cacheKey = tabInfo.tabId || '__single__';
  if (tabCache.has(cacheKey)) return tabCache.get(cacheKey);

  let html;
  if (tabInfo.html) {
    html = tabInfo.html; // đã có sẵn (single-tab case)
  } else {
    html = await fetchViaProxy(tabInfo.url);
  }

  const post = parseTabHtml(html, tabInfo.name);
  tabCache.set(cacheKey, post);
  return post;
}

// ─────────────────────────────────────────────────────────────
// PARSER — tab HTML → post object
// ─────────────────────────────────────────────────────────────
function parseTabHtml(html, tabName) {
  const doc  = parseDOM(html);
  const body = doc.querySelector('#contents') || doc.querySelector('.doc-content') || doc.body;

  cleanGDocDOM(body);

  // Lấy tất cả elements theo thứ tự xuất hiện
  const blocks = Array.from(body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,ul,ol,table,hr,figure,img'));

  if (!blocks.length) return makeEmptyPost(tabName);

  // ── Tìm vị trí separator "---" ────────────────────────────
  const sepIdx = [];
  blocks.forEach((el, i) => {
    if (/^-{3,}$/.test(el.textContent.trim())) sepIdx.push(i);
  });

  // ── Title: block đầu tiên ─────────────────────────────────
  const titleText = blocks[0]?.textContent.trim() || tabName;

  // ── Info block: giữa sep[0] và sep[1] ─────────────────────
  let info = {};
  let contentStart = 1;

  if (sepIdx.length >= 2) {
    const infoBlocks = blocks.slice(sepIdx[0] + 1, sepIdx[1]);
    info = parseInfoBlock(infoBlocks.map(el => el.textContent.trim()).join('\n'));
    contentStart = sepIdx[1] + 1;
  } else if (sepIdx.length === 1) {
    const infoBlocks = blocks.slice(1, sepIdx[0]);
    info = parseInfoBlock(infoBlocks.map(el => el.textContent.trim()).join('\n'));
    contentStart = sepIdx[0] + 1;
  }

  // ── Content: sau separator cuối ───────────────────────────
  const contentBlocks = blocks.slice(contentStart);
  const contentHtml   = buildContentHtml(contentBlocks);

  const id = info.slug || tabName || slugify(titleText);

  return {
    id,
    slug:      id,
    title:     info.title     || titleText,
    date:      info.date      ? String(info.date) : '',
    tags:      parseTags(info.tags),
    thumbnail: info.thumbnail || extractFirstImage(contentBlocks),
    summary:   info.summary   || extractSummary(contentBlocks),
    featured:  String(info.featured) === 'true',
    draft:     String(info.draft)    === 'true',
    content:   contentHtml,
    _tabName:  tabName,
    _loaded:   true,
  };
}

// ─────────────────────────────────────────────────────────────
// CONTENT BUILDER — giữ lại HTML gốc từ Google Docs,
// chỉ làm sạch styles/classes thừa và xử lý ảnh
// ─────────────────────────────────────────────────────────────
function buildContentHtml(blocks) {
  const parts = [];

  for (const el of blocks) {
    const tag  = el.tagName.toLowerCase();
    const text = el.textContent.trim();

    // Skip empty p
    if (tag === 'p' && !text && !el.querySelector('img')) continue;

    const clone = el.cloneNode(true);

    // ── Xử lý ảnh ─────────────────────────────────────────
    const images = clone.querySelectorAll('img');
    images.forEach(img => {
      // Giữ src (Google CDN URL), xóa width/height inline
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.setAttribute('loading', 'lazy');
      img.classList.add('post-img');
    });

    // Nếu block là/chứa ảnh, wrap trong figure
    if (tag === 'img' || (images.length > 0 && tag !== 'p')) {
      const allImgs = tag === 'img' ? [clone] : Array.from(clone.querySelectorAll('img'));
      allImgs.forEach(img => {
        const figure = document.createElement('figure');
        const src = img.getAttribute('src') || '';
        if (src) {
          figure.innerHTML = `<img src="${esc(src)}" loading="lazy" class="post-img">`;
          parts.push(figure.outerHTML);
        }
      });
      continue;
    }

    // ── Làm sạch Google Docs noise ─────────────────────────
    // Xóa tất cả inline style (GDocs thêm rất nhiều font/color/margin)
    clone.removeAttribute('style');
    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));

    // Xóa class GDocs (c0, c1, c2, lst-kix-...)
    clone.removeAttribute('class');
    clone.querySelectorAll('[class]').forEach(el => el.removeAttribute('class'));

    // Xóa id GDocs
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

    // Xóa span wrapper thừa (GDocs wrap mọi text trong span)
    // Giữ lại <strong>, <em>, <a>, <code> — unwrap span thuần
    clone.querySelectorAll('span').forEach(span => {
      if (!span.querySelector('strong,em,a,code,b,i')) {
        span.replaceWith(...span.childNodes);
      }
    });

    const html = clone.outerHTML;
    // Skip nếu chỉ còn tag rỗng
    if (html.replace(/<[^>]+>/g, '').trim()) parts.push(html);
  }

  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function parseInfoBlock(text) {
  const info = {};
  for (const line of text.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key   = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key) info[key] = value;
  }
  return info;
}

function parseTags(str) {
  if (!str) return [];
  return str.split(',').map(t => t.trim()).filter(Boolean);
}

function slugify(text) {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').slice(0, 60);
}

function extractFirstImage(blocks) {
  for (const el of blocks) {
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    if (img?.src) return img.src;
  }
  return '';
}

function extractSummary(blocks) {
  for (const el of blocks) {
    const text = el.textContent.trim();
    if (text.length > 20 && el.tagName === 'P') {
      return text.slice(0, 160) + (text.length > 160 ? '…' : '');
    }
  }
  return '';
}

function cleanGDocDOM(body) {
  ['script','style','#header','#footer','.header',
   'header','footer','nav.nav-bar','#google-sheet-embed'].forEach(sel => {
    try { body.querySelectorAll(sel).forEach(el => el.remove()); } catch {}
  });
}

function makeEmptyPost(id) {
  return { id, slug: id, title: id, date: '', tags: [], thumbnail: '',
           summary: '', featured: false, draft: false,
           content: '<p>Không có nội dung.</p>', _loaded: true };
}

function sortPosts(posts, asc = false) {
  return [...posts].sort((a, b) => {
    const da = new Date(a.date||0), db = new Date(b.date||0);
    return asc ? da - db : db - da;
  });
}

function formatDate(str) {
  if (!str) return '';
  try {
    return new Date(str).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
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
  posts.forEach(p => (p.tags||[]).forEach(t => s.add(t)));
  return ['all', ...Array.from(s).sort()];
}

// ─────────────────────────────────────────────────────────────
// SITE CONFIG
// ─────────────────────────────────────────────────────────────
function applySiteConfig() {
  const { site, author } = state;
  if (site.name) document.title = `${site.name} — ${site.tagline||'Blog'}`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', site.description||'');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', site.themeColor||'');
  if (site.language) document.documentElement.lang = site.language;

  if (document.getElementById('heroKicker')  && site.heroKicker)  document.getElementById('heroKicker').textContent = site.heroKicker;
  if (document.getElementById('heroHeading') && site.heroHeading) document.getElementById('heroHeading').innerHTML  = site.heroHeading;
  if (document.getElementById('heroSub'))                         document.getElementById('heroSub').textContent    = site.heroSub || author.bio || '';

  const socialsEl = document.getElementById('heroSocials');
  if (socialsEl && author.socials?.length) {
    socialsEl.innerHTML = author.socials
      .map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener" class="social-link">${esc(s.label)}</a>`)
      .join('');
  }

  if (state.footer.copyright) document.getElementById('footerCopy').textContent = state.footer.copyright;
  if (state.footer.poweredBy) {
    const fl = document.getElementById('footerLink');
    if (fl) { fl.textContent = state.footer.poweredBy.label; fl.href = state.footer.poweredBy.url; }
  }
}

// ─────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────
function renderNavigation() {
  const nav = document.getElementById('headerNav');
  if (!nav || !state.navigation.length) return;
  nav.innerHTML = state.navigation.map(item => {
    const active = item.action==='home' && state.activeTag==='all' && !state.currentPost ? ' active' : '';
    return `<button class="nav-item${active}" data-action="${esc(item.action)}" data-tag="${esc(item.tag||'')}">${esc(item.label)}</button>`;
  }).join('');
  nav.addEventListener('click', e => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    if (btn.dataset.action === 'home') {
      state.activeTag='all'; state.searchQuery='';
      const si = document.getElementById('searchInput');
      if (si) si.value = '';
      navigateTo(null);
    } else if (btn.dataset.action === 'filter' && btn.dataset.tag) {
      state.activeTag = btn.dataset.tag; navigateTo(null);
    }
    updateNavActive(); applyFilters(); updateTagBtnActive();
  });
}

function updateNavActive() {
  document.getElementById('headerNav')?.querySelectorAll('.nav-item').forEach(btn => {
    const a = (btn.dataset.action==='home' && state.activeTag==='all' && !state.currentPost)
           || (btn.dataset.action==='filter' && btn.dataset.tag===state.activeTag);
    btn.classList.toggle('active', a);
  });
}

function updateTagBtnActive() {
  document.getElementById('tagFilters')?.querySelectorAll('.tag-btn').forEach(b => {
    const a = b.dataset.tag === state.activeTag;
    b.classList.toggle('active', a);
    b.setAttribute('aria-pressed', a);
  });
}

// ─────────────────────────────────────────────────────────────
// PIXEL GRID
// ─────────────────────────────────────────────────────────────
function initPixelGrid() {
  const grid = document.getElementById('pixelGrid');
  if (!grid) return;
  const colors = ['var(--accent)','var(--magenta)','var(--lime)',
    'rgba(255,255,255,0.06)','rgba(255,255,255,0.03)','transparent','transparent','transparent'];
  for (let i = 0; i < 64; i++) {
    const cell = document.createElement('div');
    cell.className = 'pixel-cell';
    cell.style.background = colors[Math.floor(Math.random()*colors.length)];
    cell.style.animationDelay = `${Math.random()*800}ms`;
    grid.appendChild(cell);
  }
  setInterval(() => {
    const cells = grid.querySelectorAll('.pixel-cell');
    cells[Math.floor(Math.random()*cells.length)].style.background =
      colors[Math.floor(Math.random()*colors.length)];
  }, 1200);
}

// ─────────────────────────────────────────────────────────────
// FILTER / SEARCH
// ─────────────────────────────────────────────────────────────
function applyFilters() {
  let result = [...state.posts];
  if (state.activeTag !== 'all')
    result = result.filter(p => Array.isArray(p.tags) && p.tags.includes(state.activeTag));
  const q = state.searchQuery.trim().toLowerCase();
  if (q) result = result.filter(p => (p.title||'').toLowerCase().includes(q) || (p.summary||'').toLowerCase().includes(q));
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
    const label = tag==='all' ? 'Tất cả' : `#${tag}`;
    return `<button class="tag-btn${tag===state.activeTag?' active':''}" data-tag="${esc(tag)}" aria-pressed="${tag===state.activeTag}">${esc(label)}</button>`;
  }).join('');
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.tag-btn');
    if (!btn) return;
    state.activeTag = btn.dataset.tag;
    updateTagBtnActive(); updateNavActive(); applyFilters();
  });
}

// ─────────────────────────────────────────────────────────────
// RENDER: CARD
// ─────────────────────────────────────────────────────────────
function createCard(post) {
  const article = document.createElement('article');
  article.className = `post-card${post.featured?' featured':''}`;
  article.setAttribute('role','button'); article.setAttribute('tabindex','0');
  article.setAttribute('aria-label', `Đọc: ${post.title}`);
  const tagsHtml = (post.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('');
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
    <span class="read-more">Đọc tiếp</span>`;
  const img = article.querySelector('img');
  if (img) {
    img.addEventListener('load',  () => { img.classList.add('loaded'); article.querySelector('.thumb-placeholder')?.remove(); });
    img.addEventListener('error', () => img.closest('.post-thumb')?.remove());
  }
  const nav = () => navigateTo(post.id);
  article.addEventListener('click', nav);
  article.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); nav(); } });
  return article;
}

// ─────────────────────────────────────────────────────────────
// RENDER: LIST
// ─────────────────────────────────────────────────────────────
function renderList() {
  const listEl=document.getElementById('postList'), countEl=document.getElementById('postsCount'),
        featEl=document.getElementById('featuredGrid'), featSecEl=document.getElementById('featuredSection');
  if (!listEl) return;
  if (countEl) {
    const t=state.posts.length, s=state.filtered.length;
    countEl.innerHTML = s===t ? `<strong>${t}</strong> bài viết` : `Đang hiển thị <strong>${s}</strong> / ${t} bài viết`;
  }
  if (featEl && featSecEl) {
    const noFilter = state.activeTag==='all' && state.searchQuery==='';
    const featured = state.posts.filter(p=>p.featured);
    if (noFilter && featured.length) { featSecEl.classList.remove('hidden'); featEl.innerHTML=''; featured.forEach(p=>featEl.appendChild(createCard(p))); }
    else featSecEl.classList.add('hidden');
  }
  listEl.innerHTML = '';
  if (!state.filtered.length) { listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">¯\\_(ツ)_/¯</div><p>Không tìm thấy bài viết nào.</p></div>`; return; }
  state.filtered.forEach(p=>listEl.appendChild(createCard(p)));
}

// ─────────────────────────────────────────────────────────────
// RENDER: DETAIL
// ─────────────────────────────────────────────────────────────
async function renderDetail(postId) {
  const post = state.posts.find(p => p.id === postId);
  if (!post) { navigateTo(null); return; }

  document.getElementById('listView').style.display = 'none';
  const detailEl = document.getElementById('detailView');
  detailEl.style.display = 'block';
  window.scrollTo({ top:0, behavior:'instant' });

  detailEl.innerHTML = `
    <div class="detail-topbar"><div class="container">
      <button class="back-btn" id="backBtn">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>Quay lại
      </button>
    </div></div>
    <div class="detail-loading">
      <div class="loading-spinner"></div>
      <p class="loading-label">Đang tải từ Google Docs...</p>
    </div>`;
  document.getElementById('backBtn').addEventListener('click', ()=>navigateTo(null));

  state.currentPost = post;
  document.title = `${post.title} — ${state.site.name||'NIX'}`;

  const tagsHtml = (post.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('');
  const thumbSrc = assetSrc(post.thumbnail);
  const author   = state.author||{};
  const avatarSrc = assetSrc(author.avatar);
  const avatarInner = avatarSrc ? `<img src="${esc(avatarSrc)}" alt="${esc(author.name)}">` : esc((author.name||'N')[0]);

  detailEl.innerHTML = `
    <div class="detail-topbar"><div class="container">
      <button class="back-btn" id="backBtn">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>Quay lại
      </button>
      <a href="${esc(state.gdocUrl)}" target="_blank" rel="noopener" class="gdoc-link">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/></svg>
        Xem Docs
      </a>
    </div></div>
    <div class="detail-header">
      <p class="detail-kicker">${(post.tags||[]).join(' · ')||'Bài viết'}</p>
      <h1 class="detail-title">${esc(post.title)}</h1>
      <div class="detail-meta">
        <span class="detail-date">${formatDate(post.date)}</span>
        ${tagsHtml ? `<div class="detail-tags">${tagsHtml}</div>` : ''}
      </div>
      ${author.name ? `<div class="detail-author">
        <div class="detail-author-avatar">${avatarInner}</div>
        <div class="detail-author-info">
          <span class="detail-author-name">${esc(author.name)}</span>
          <span class="detail-author-role">Game Developer</span>
        </div>
      </div>` : ''}
    </div>
    ${thumbSrc ? `<div class="detail-thumb" id="detailThumb"><img src="${thumbSrc}" alt="${esc(post.title)}" loading="lazy"></div>` : ''}
    <div class="detail-content gdoc-content">${post.content}</div>`;

  document.getElementById('detailThumb')?.querySelector('img')?.addEventListener('load', e => e.target.closest('.detail-thumb').classList.add('loaded'));
  document.getElementById('backBtn').addEventListener('click', ()=>navigateTo(null));
  updateNavActive();
}

// ─────────────────────────────────────────────────────────────
// ROUTING
// ─────────────────────────────────────────────────────────────
function navigateTo(postId) {
  if (postId) { location.hash = postId; }
  else { history.pushState('', document.title, window.location.pathname+window.location.search); showListView(); }
}

function showListView() {
  state.currentPost = null;
  document.title = `${state.site.name||'NIX'} — ${state.site.tagline||'Blog'}`;
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('listView').style.display   = 'block';
  window.scrollTo({ top:0, behavior:'instant' });
  updateNavActive();
}

function handleRoute() {
  const hash = location.hash.replace(/^#/,'').trim();
  if (hash && state.posts.length) renderDetail(hash);
  else if (!hash) showListView();
}

// ─────────────────────────────────────────────────────────────
// BIND CONTROLS
// ─────────────────────────────────────────────────────────────
function bindLogo() {
  document.getElementById('logoBtn')?.addEventListener('click', () => {
    state.activeTag='all'; state.searchQuery='';
    const si=document.getElementById('searchInput'); if(si) si.value='';
    navigateTo(null); updateNavActive(); updateTagBtnActive(); applyFilters();
  });
}

function bindSort() {
  const btn = document.getElementById('sortBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    state.sortAsc = !state.sortAsc;
    const icon = `<svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    btn.innerHTML = `${icon} ${state.sortAsc?'Cũ nhất':'Mới nhất'}`;
    applyFilters();
  });
}

function bindSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  let timer;
  input.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(()=>{ state.searchQuery=e.target.value; applyFilters(); }, 220);
  });
}

function showLoading() {
  const el=document.getElementById('mainContent');
  if (el) el.innerHTML=`<div class="loading-wrap"><div class="loading-spinner"></div><p class="loading-label">LOADING POSTS...</p></div>`;
}

function showError(msg) {
  const el=document.getElementById('mainContent');
  if (el) el.innerHTML=`<div class="container"><div class="error-wrap"><div class="error-code">ERR</div><p class="error-msg">${esc(msg)}</p><p class="error-hint">Kiểm tra: gdoc_url trong web-config.json đã là link /pub chưa?</p></div></div>`;
}

function mountListLayout() {
  const el=document.getElementById('mainContent');
  if (!el) return;
  el.innerHTML=`
    <section id="featuredSection" class="featured-section hidden">
      <div class="container"><div class="section-label">Featured</div><div id="featuredGrid" class="featured-grid"></div></div>
    </section>
    <section class="posts-section">
      <div class="container"><div class="section-label">Tất cả bài viết</div><p id="postsCount" class="posts-count"></p><div id="postList" class="post-list"></div></div>
    </section>`;
}

function updatePostCount() {
  const el=document.getElementById('postCountStatus');
  if (el) el.textContent=state.posts.length;
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
async function init() {
  showLoading();
  try {
    // 1. Load web-config.json
    const cfgRes = await fetch(URL_CFG);
    if (!cfgRes.ok) throw new Error(`Không tải được web-config.json (HTTP ${cfgRes.status})`);
    const config = await cfgRes.json();

    state.site       = config.site       || {};
    state.author     = config.author     || {};
    state.navigation = config.navigation || [];
    state.footer     = config.footer     || {};
    state.gdocUrl    = config.gdoc_url   || '';

    if (!state.gdocUrl) throw new Error('web-config.json thiếu field "gdoc_url".');

    // 2. Fetch danh sách tabs từ Google Doc
    const tabs = await fetchTabList(state.gdocUrl);
    if (!tabs.length) throw new Error('Không tìm thấy tab nào trong Google Doc.');

    // 3. Fetch & parse từng tab song song
    const rawPosts = await Promise.all(tabs.map(tab => fetchTab(tab).catch(err => {
      console.warn(`[NIX] Lỗi tab "${tab.name}":`, err);
      return makeEmptyPost(tab.name);
    })));

    // 4. Lọc draft
    state.posts = rawPosts.filter(p => !p.draft);

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
