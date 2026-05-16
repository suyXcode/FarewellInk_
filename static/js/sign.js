'use strict';
/* ═══════════════════════════════════════════════════════════════
   FarewellInk 2026 — sign.js  (FIXED)
   Bug 1: Canvas 0x0 on init  → offsetWidth + requestAnimationFrame
   Bug 2: Transform stacking  → setTransform reset before scale
   Bug 3: Buttons not working → errors silently broke all listeners
   Bug 4: Mobile disappear    → visualViewport + savedData restore
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Element refs ─────────────────────────────────────────── */
  const sigCanvas = document.getElementById('signaturePad');
  const bgCanvas  = document.getElementById('bgCanvas');
  const wrapEl    = document.getElementById('canvasWrap');
  const hintEl    = document.getElementById('canvasHint');
  const overlay   = document.getElementById('stickerOverlay');
  const colorIn   = document.getElementById('penColor');
  const widthIn   = document.getElementById('strokeWidth');

  if (!sigCanvas || !bgCanvas || !wrapEl) {
    console.error('FarewellInk: canvas elements missing');
    return;
  }

  /* ── State ────────────────────────────────────────────────── */
  let currentBg  = 'dark';
  let stickers   = [];
  let profileB64 = null;
  let savedData  = null;
  let resizeTimer= null;
  const RATIO    = Math.max(window.devicePixelRatio || 1, 2);

  /* ── Canvas height matching CSS ───────────────────────────── */
  function getH() { return window.innerWidth >= 992 ? 300 : 210; }

  /* ── Signature Pad ────────────────────────────────────────── */
  const pad = new SignaturePad(sigCanvas, {
    minWidth: 1,
    maxWidth: parseFloat(widthIn?.value || 3) * 2,
    penColor: colorIn?.value || '#e2c97e',
    backgroundColor: 'rgba(0,0,0,0)',
    velocityFilterWeight: 0.7,
  });

  /* ── fitCanvas ─────────────────────────────────────────────
     FIX 1: use offsetWidth (reliable before paint)
     FIX 2: setTransform reset prevents transform stacking
     FIX 3: defer first call with requestAnimationFrame       */
  function fitCanvas(restore) {
    if (restore && !pad.isEmpty()) savedData = pad.toData();

    const W = wrapEl.offsetWidth || wrapEl.clientWidth || 360;
    const H = getH();

    [sigCanvas, bgCanvas].forEach(c => {
      c.width  = W * RATIO;
      c.height = H * RATIO;
      c.style.width  = W + 'px';
      c.style.height = H + 'px';
      const ctx = c.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0); // ✅ RESET before scale
      ctx.scale(RATIO, RATIO);
    });

    pad.clear();
    drawBg();

    if (restore && savedData && savedData.length) pad.fromData(savedData);
    renderStickers();
  }

  // ✅ FIX: defer until after browser paints layout
  requestAnimationFrame(() => fitCanvas(false));

  /* ── Resize handler ───────────────────────────────────────── */
  const resizeSrc = window.visualViewport || window;
  resizeSrc.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => fitCanvas(true), 280);
  }, { passive: true });

  /* ── Block page scroll while drawing (mobile) ─────────────── */
  sigCanvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  sigCanvas.addEventListener('touchmove',  e => e.preventDefault(), { passive: false });

  /* ── Hint / active state ─────────────────────────────────── */
  pad.addEventListener('beginStroke', () => {
    hintEl?.classList.add('hidden');
    wrapEl.classList.add('active');
  });
  pad.addEventListener('endStroke', () => {
    savedData = pad.isEmpty() ? null : pad.toData();
    if (pad.isEmpty()) {
      hintEl?.classList.remove('hidden');
      wrapEl.classList.remove('active');
    }
  });

  /* ── Pen controls ─────────────────────────────────────────── */
  colorIn?.addEventListener('input', () => { pad.penColor = colorIn.value; });
  widthIn?.addEventListener('input', () => {
    const v = parseFloat(widthIn.value);
    pad.minWidth = v * 0.5;
    pad.maxWidth = v * 2.2;
  });

  /* ══════════════════════════════════════════════════════════
     BUTTONS
  ══════════════════════════════════════════════════════════ */

  document.getElementById('btnClear')?.addEventListener('click', () => {
    pad.clear();
    savedData = null;
    stickers  = [];
    renderStickers();
    drawBg();
    hintEl?.classList.remove('hidden');
    wrapEl.classList.remove('active');
  });

  document.getElementById('btnUndo')?.addEventListener('click', () => {
    const data = pad.toData();
    if (!data || !data.length) return;
    data.pop();
    pad.fromData(data);
    savedData = data.length ? data : null;
    drawBg();
    if (pad.isEmpty()) {
      hintEl?.classList.remove('hidden');
      wrapEl.classList.remove('active');
    }
  });

  document.getElementById('btnReplay')?.addEventListener('click', () => {
    const data = pad.toData();
    if (!data || !data.length) return;
    pad.clear(); drawBg();
    let si = 0, pi = 0;
    (function step() {
      if (si >= data.length) { pad.fromData(data); return; }
      const g = data[si];
      pad.fromData([...data.slice(0, si), { ...g, points: g.points.slice(0, pi + 4) }]);
      pi += 4;
      if (pi >= g.points.length) { si++; pi = 0; }
      requestAnimationFrame(step);
    })();
  });

  /* ══════════════════════════════════════════════════════════
     BACKGROUND CHOOSER
  ══════════════════════════════════════════════════════════ */
  const BG_DEFS = {
    dark:     { type:'solid',    fill:'#1a1a2e' },
    light:    { type:'solid',    fill:'#f4f1ec' },
    gold:     { type:'gradient', from:'#2a1f0e', to:'#c8960a' },
    purple:   { type:'gradient', from:'#1a0a2e', to:'#4a1070' },
    midnight: { type:'gradient', from:'#0a1628', to:'#0a2a4a' },
    grid:     { type:'grid',     fill:'#0d0d1e' },
  };

  function drawBg() {
    const W   = bgCanvas.offsetWidth  || 360;
    const H   = bgCanvas.offsetHeight || getH();
    const ctx = bgCanvas.getContext('2d');
    const def = BG_DEFS[currentBg] || BG_DEFS.dark;
    ctx.clearRect(0, 0, W, H);

    if (def.type === 'solid') {
      ctx.fillStyle = def.fill;
      ctx.fillRect(0, 0, W, H);
    } else if (def.type === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, def.from);
      g.addColorStop(1, def.to);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    } else if (def.type === 'grid') {
      ctx.fillStyle = def.fill;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth   = 0.8;
      for (let x = 0; x <= W; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y <= H; y += 24) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    }
  }

  document.querySelectorAll('.bg-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentBg = btn.dataset.bg;
      drawBg();
    });
  });

  /* ══════════════════════════════════════════════════════════
     STICKERS
  ══════════════════════════════════════════════════════════ */
  document.querySelectorAll('.sticker-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      stickers.push({
        emoji: btn.dataset.emoji,
        xPct:  20 + Math.random() * 60,
        yPct:  20 + Math.random() * 60,
      });
      renderStickers();
      btn.style.transform = 'scale(1.5)';
      setTimeout(() => { btn.style.transform = ''; }, 200);
    });
  });

  document.getElementById('clearStickers')?.addEventListener('click', () => {
    stickers = [];
    renderStickers();
  });

  function renderStickers() {
    if (!overlay) return;
    overlay.innerHTML = '';
    stickers.forEach((s, i) => {
      const el       = document.createElement('span');
      el.className   = 'sticker-item';
      el.textContent = s.emoji;
      el.style.left  = s.xPct + '%';
      el.style.top   = s.yPct + '%';
      el.title       = 'Click to remove';
      el.addEventListener('click', () => { stickers.splice(i, 1); renderStickers(); });
      overlay.appendChild(el);
    });
  }

  /* ── Composite: bg + signature + stickers → PNG ──────────── */
  function getCompositeDataURL() {
    const W    = wrapEl.offsetWidth || 360;
    const H    = getH();
    const comp = document.createElement('canvas');
    comp.width  = W * RATIO;
    comp.height = H * RATIO;
    const ctx   = comp.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(RATIO, RATIO);

    // 1. Background
    const def = BG_DEFS[currentBg] || BG_DEFS.dark;
    if (def.type === 'solid') {
      ctx.fillStyle = def.fill; ctx.fillRect(0, 0, W, H);
    } else if (def.type === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, def.from); g.addColorStop(1, def.to);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = def.fill; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.8;
      for (let x = 0; x <= W; x += 24) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 24) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    }

    // 2. Stickers
    const fs = Math.max(22, W * 0.055);
    ctx.font = `${fs}px serif`;
    ctx.textBaseline = 'middle';
    stickers.forEach(s => {
      ctx.fillText(s.emoji, (s.xPct / 100) * W, (s.yPct / 100) * H);
    });

    // 3. Signature on top
    ctx.drawImage(sigCanvas, 0, 0, W, H);

    return comp.toDataURL('image/png');
  }

  /* ══════════════════════════════════════════════════════════
     FONT PICKER
  ══════════════════════════════════════════════════════════ */
  const nameInput   = document.getElementById('name');
  const fontPreview = document.getElementById('fontPreview');

  function updateFontPreview() {
    const sel  = document.querySelector('input[name="fontChoice"]:checked');
    const font = sel?.value || 'Pacifico';
    const text = nameInput?.value.trim() || 'Your Name Here';
    if (fontPreview) {
      fontPreview.style.fontFamily = `'${font}', cursive`;
      fontPreview.textContent = text;
    }
  }
  document.querySelectorAll('input[name="fontChoice"]').forEach(r => {
    r.addEventListener('change', updateFontPreview);
  });
  nameInput?.addEventListener('input', updateFontPreview);
  updateFontPreview();

  /* ══════════════════════════════════════════════════════════
     PROFILE PHOTO
  ══════════════════════════════════════════════════════════ */
  const photoInput   = document.getElementById('photoInput');
  const photoPreview = document.getElementById('photoPreview');

  photoInput?.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Photo must be under 5 MB'); return; }
    const reader  = new FileReader();
    reader.onload = e => {
      profileB64 = e.target.result;
      if (photoPreview) {
        photoPreview.classList.add('has-photo');
        photoPreview.innerHTML = `<img src="${profileB64}" alt="preview" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
      }
    };
    reader.readAsDataURL(file);
  });

  /* ══════════════════════════════════════════════════════════
     MESSAGE COUNTER
  ══════════════════════════════════════════════════════════ */
  const msgArea  = document.getElementById('message');
  const msgCount = document.getElementById('msgCount');
  msgArea?.addEventListener('input', () => {
    if (!msgCount) return;
    const n = msgArea.value.length;
    msgCount.textContent = n;
    msgCount.style.color = n > 1800 ? '#ef9a9a' : n > 1500 ? '#ffd54f' : '';
  });

  /* ══════════════════════════════════════════════════════════
     FORM SUBMIT
  ══════════════════════════════════════════════════════════ */
  const form      = document.getElementById('signForm');
  const submitBtn = document.getElementById('submitBtn');

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    let valid = true;

    function check(id, testFn, errMsg) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('is-invalid', 'is-valid');
      let fb = el.parentElement.querySelector('.invalid-feedback');
      if (!fb) { fb = document.createElement('div'); fb.className = 'invalid-feedback'; el.after(fb); }
      if (!testFn(el.value)) { el.classList.add('is-invalid'); fb.textContent = errMsg; valid = false; }
      else                   { el.classList.add('is-valid');   fb.textContent = ''; }
    }

    check('name',            v => v.trim().length >= 2,  'Enter your full name.');
    check('branch',          v => v.trim() !== '',       'Select your branch.');
    check('graduation_year', v => /^\d{4}$/.test(v),    'Enter a valid 4-digit year.');
    check('message',         v => v.trim().length >= 10, 'Write at least 10 characters.');

    if (pad.isEmpty()) {
      wrapEl.style.borderColor = 'rgba(244,67,54,0.7)';
      wrapEl.style.borderStyle = 'solid';
      alert('✍️ Please draw your signature on the canvas first!');
      valid = false;
    } else {
      wrapEl.style.borderColor = '';
      wrapEl.style.borderStyle = '';
    }
    if (!valid) return;

    const selFont  = document.querySelector('input[name="fontChoice"]:checked')?.value || 'Pacifico';
    const selTheme = document.querySelector('input[name="cardTheme"]:checked')?.value  || 'gold';

    const payload = {
      name:            document.getElementById('name').value.trim(),
      nickname:        document.getElementById('nickname')?.value.trim()         || '',
      branch:          document.getElementById('branch').value,
      graduation_year: document.getElementById('graduation_year').value,
      message:         document.getElementById('message').value.trim(),
      favorite_memory: document.getElementById('favorite_memory')?.value.trim() || '',
      font:       selFont,
      pen_color:  colorIn?.value || '#e2c97e',
      card_theme: selTheme,
      signature_data: getCompositeDataURL(),
      profile_photo:  profileB64 || '',
    };

    // Loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.querySelector('.submit-text')?.classList.add('d-none');
      submitBtn.querySelector('.submit-spinner')?.classList.remove('d-none');
    }

    try {
      const res  = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        window.launchConfetti?.();
        const qEl = document.getElementById('modalQuote');
        if (qEl) qEl.textContent = `"${data.quote}"`;
        new bootstrap.Modal(document.getElementById('successModal')).show();

        // Reset all
        form.reset();
        pad.clear();
        savedData = null; stickers = []; profileB64 = null; currentBg = 'dark';
        document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
        document.querySelector('.bg-opt[data-bg="dark"]')?.classList.add('active');
        renderStickers(); drawBg();
        hintEl?.classList.remove('hidden');
        wrapEl.classList.remove('active');
        wrapEl.style.borderColor = '';
        if (photoPreview) {
          photoPreview.classList.remove('has-photo');
          photoPreview.innerHTML = '<i class="fas fa-camera"></i><span>Add Photo</span>';
        }
        document.querySelectorAll('.fi-input.is-valid').forEach(el => el.classList.remove('is-valid'));
        updateFontPreview();
      } else {
        alert('⚠️ Error: ' + (data.error || 'Something went wrong.'));
      }
    } catch (err) {
      console.error(err);
      alert('🌐 Network error — check your connection.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.querySelector('.submit-text')?.classList.remove('d-none');
        submitBtn.querySelector('.submit-spinner')?.classList.add('d-none');
      }
    }
  });

}); // end DOMContentLoaded
