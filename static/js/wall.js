'use strict';
/* FarewellInk 2026 — wall.js */

(function () {
  let page = 1, loading = false, hasMore = true;
  let searchVal = '', branchVal = '', themeVal = '';

  const grid     = document.getElementById('wallGrid');
  const spinner  = document.getElementById('wallLoading');
  const sentinel = document.getElementById('loadMoreSentinel');
  const countEl  = document.getElementById('wallCount');
  const modalEl  = document.getElementById('sigModal');
  const modalBody= document.getElementById('sigModalBody');
  const bsModal  = modalEl ? new bootstrap.Modal(modalEl) : null;

  const THEME_COLORS = {
    gold:   { bg: 'linear-gradient(135deg,#2a1f0e,#1a1200)', accent: '#e2c97e' },
    purple: { bg: 'linear-gradient(135deg,#1a0a2e,#0d0020)', accent: '#9b59b6' },
    blue:   { bg: 'linear-gradient(135deg,#0a1628,#061020)', accent: '#3498db' },
    green:  { bg: 'linear-gradient(135deg,#0a2010,#051008)', accent: '#27ae60' },
    rose:   { bg: 'linear-gradient(135deg,#2a0a14,#18050c)', accent: '#e91e8c' },
    orange: { bg: 'linear-gradient(135deg,#2a1400,#180a00)', accent: '#e67e22' },
  };

  // ── Initial load ──────────────────────────────────────────────────────────
  loadPage();

  // ── Search (debounced) ────────────────────────────────────────────────────
  let dTimer;
  document.getElementById('searchInput')?.addEventListener('input', e => {
    clearTimeout(dTimer);
    dTimer = setTimeout(() => { searchVal = e.target.value.trim(); reset(); }, 360);
  });
  document.getElementById('branchFilter')?.addEventListener('change', e => { branchVal = e.target.value; reset(); });
  document.getElementById('themeFilter')?.addEventListener('change',  e => { themeVal  = e.target.value; reset(); });

  // ── Infinite scroll ───────────────────────────────────────────────────────
  if (sentinel) {
    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && hasMore) loadPage();
    }, { rootMargin: '200px' }).observe(sentinel);
  }

  // ── Load ──────────────────────────────────────────────────────────────────
  async function loadPage() {
    if (loading || !hasMore) return;
    loading = true;
    if (spinner) spinner.style.display = 'block';

    const params = new URLSearchParams({ page, search: searchVal, branch: branchVal, theme: themeVal });
    try {
      const res  = await fetch(`/api/signatures?${params}`);
      const data = await res.json();

      if (page === 1 && countEl) countEl.textContent = data.total;

      if (!data.signatures.length && page === 1) {
        grid.innerHTML = emptyHTML();
      } else {
        data.signatures.forEach(s => grid.insertAdjacentHTML('beforeend', buildCard(s)));
        if (typeof AOS !== 'undefined') AOS.refresh();
      }
      hasMore = data.has_more;
      page++;
    } catch (err) {
      console.error(err);
      if (page === 1) grid.innerHTML = errorHTML();
    } finally {
      loading = false;
      if (spinner) spinner.style.display = 'none';
    }
  }

  function reset() { page = 1; hasMore = true; grid.innerHTML = ''; loadPage(); }

  // ── Card builder ──────────────────────────────────────────────────────────
  function buildCard(s) {
    const tc     = THEME_COLORS[s.card_theme] || THEME_COLORS.gold;
    const sigImg = s.signature_image
      ? `<img src="/static/${s.signature_image}" class="wall-sig-img" alt="signature" loading="lazy"
             style="background:linear-gradient(135deg,${tc.bg.slice(tc.bg.indexOf('#'))})" />`
      : `<div class="wall-sig-img" style="display:flex;align-items:center;justify-content:center;
              font-size:2.8rem;color:rgba(255,255,255,.12);padding:1rem;
              background:linear-gradient(135deg,rgba(0,0,0,.3),rgba(0,0,0,.1))">✍️</div>`;

    const avatar = s.profile_photo
      ? `<img src="/static/${s.profile_photo}" class="wall-avatar-img" alt="${esc(s.name)}"/>`
      : `<div class="wall-avatar">${s.name.charAt(0).toUpperCase()}</div>`;

    return `
    <div class="wall-card" data-id="${s.id}" data-aos="fade-up"
         onclick='openModal(${JSON.stringify(s).replace(/'/g,"&#39;")})'
         style="border-color:${tc.accent}22">
      <div class="wall-card-inner" style="background:${tc.bg}">
        ${sigImg}
        <div class="wall-card-body">
          <div class="d-flex align-items-center gap-2 mb-2">
            ${avatar}
            <div>
              <div class="wall-name" style="font-family:'${esc(s.font)}',cursive;color:${esc(s.pen_color)}">
                ${esc(s.name)}
              </div>
              <div class="wall-branch">${esc(s.branch)} · ${s.graduation_year}</div>
            </div>
          </div>
          <p class="wall-message">${esc(s.message)}</p>
          <div class="d-flex justify-content-between align-items-center mt-2">
            <span class="wall-date">${s.created_at}</span>
            <div class="wall-reactions">
              <button class="wall-react"
                onclick="event.stopPropagation();react(${s.id},'likes',this)">
                ❤️ ${s.likes}
              </button>
              <button class="wall-react"
                onclick="event.stopPropagation();react(${s.id},'fires',this)">
                🔥 ${s.fires}
              </button>
              <button class="wall-react"
                onclick="event.stopPropagation();react(${s.id},'caps',this)">
                🎓 ${s.caps}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  window.openModal = function (s) {
    if (!bsModal || !modalBody) return;
    const tc = THEME_COLORS[s.card_theme] || THEME_COLORS.gold;

    const avatar = s.profile_photo
      ? `<img src="/static/${s.profile_photo}" class="detail-avatar-img" alt="${esc(s.name)}"/>`
      : `<div class="detail-avatar" style="background:${tc.bg}">${s.name.charAt(0).toUpperCase()}</div>`;

    const sigImg = s.signature_image
      ? `<div class="detail-sig-wrap mb-3" style="background:rgba(0,0,0,.2)">
           <img src="/static/${s.signature_image}" class="detail-sig" alt="signature"/>
         </div>` : '';

    modalBody.innerHTML = `
      <div class="d-flex align-items-center gap-3 mb-3">
        ${avatar}
        <div>
          <h4 class="mb-0" style="font-family:'${esc(s.font)}',cursive;color:${esc(s.pen_color)}">
            ${esc(s.name)}
          </h4>
          ${s.nickname ? `<div class="text-muted fst-italic small">"${esc(s.nickname)}"</div>` : ''}
          <div class="d-flex gap-1 mt-1 flex-wrap">
            <span class="fi-badge" style="color:${tc.accent};border-color:${tc.accent}44">${esc(s.branch)}</span>
            <span class="fi-badge-outline">Class of ${s.graduation_year}</span>
          </div>
        </div>
      </div>
      ${sigImg}
      <blockquote class="fi-quote-detail mb-3" style="border-left-color:${tc.accent}">
        ${esc(s.message)}
      </blockquote>
      ${s.favorite_memory ? `<div class="fav-memory mb-3"><div class="fav-label">❤️ Favourite Memory</div><p class="mb-0">${esc(s.favorite_memory)}</p></div>` : ''}
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
        <span class="wall-date">${s.created_at}</span>
        <div class="d-flex gap-2">
          <a href="/signature/${s.id}" class="btn fi-btn-ghost btn-sm">Full View</a>
          <a href="/download/png/${s.id}" class="btn fi-btn-primary btn-sm">
            <i class="fas fa-download me-1"></i>PNG
          </a>
        </div>
      </div>`;
    bsModal.show();
  };

  // ── Reactions ─────────────────────────────────────────────────────────────
  window.react = async function (id, kind, btn) {
    btn.style.transform = 'scale(1.5)';
    setTimeout(() => btn.style.transform = '', 250);
    try {
      const res  = await fetch(`/api/react/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      const d = await res.json();
      const btns = btn.closest('.wall-reactions')?.querySelectorAll('.wall-react');
      if (btns) {
        btns[0].textContent = `❤️ ${d.likes}`;
        btns[1].textContent = `🔥 ${d.fires}`;
        btns[2].textContent = `🎓 ${d.caps}`;
      }
    } catch (e) { console.error(e); }
  };

  // ── Socket live updates ───────────────────────────────────────────────────
  if (typeof io !== 'undefined') {
    const socket = io({ transports: ['websocket', 'polling'] });

    socket.on('new_signature', sig => {
      if (page === 2 && !searchVal && !branchVal && !themeVal) {
        grid.insertAdjacentHTML('afterbegin', buildCard(sig));
        if (typeof AOS !== 'undefined') AOS.refresh();
        if (countEl) countEl.textContent = parseInt(countEl.textContent || 0) + 1;
      }
    });

    socket.on('signature_removed', data => {
      const card = document.querySelector(`.wall-card[data-id="${data.id}"]`);
      if (card) {
        card.style.transition = 'opacity .4s, transform .4s';
        card.style.opacity    = '0';
        card.style.transform  = 'scale(.9)';
        setTimeout(() => { card.remove(); }, 420);
        if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent || 0) - 1);
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function emptyHTML() {
    return `<div style="text-align:center;padding:4rem 1rem;color:var(--text-muted)">
      <div style="font-size:3rem">🎓</div>
      <p class="mt-3">No signatures yet. <a href="/sign" class="text-decoration-none" style="color:var(--gold)">Be the first!</a></p>
    </div>`;
  }
  function errorHTML() {
    return `<div style="text-align:center;padding:4rem 1rem;color:var(--text-muted)">
      <i class="fas fa-exclamation-circle me-2"></i>Failed to load. Please refresh.
    </div>`;
  }
})();
