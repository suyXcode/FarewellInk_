'use strict';
// ── Loading screen ──────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  const ls = document.getElementById('loading-screen');
  if (!ls) return;
  setTimeout(() => {
    ls.classList.add('hidden');
    ls.addEventListener('transitionend', () => ls.remove(), { once: true });
  }, 1900);
});

document.addEventListener('DOMContentLoaded', () => {
  AOS.init({ duration: 650, easing: 'ease-out-cubic', once: true, offset: 50 });
  initNavbar();
  initTheme();
  initMusic();
  initSocket();
  initParticles();
  initFloatingCaps();
});

// ── Navbar ──────────────────────────────────────────────────────────────────
function initNavbar() {
  const nav = document.getElementById('mainNav');
  if (!nav) return;
  const update = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

// ── Theme ────────────────────────────────────────────────────────────────────
function initTheme() {
  const html  = document.documentElement;
  const saved = localStorage.getItem('fi-theme') || 'dark';
  html.dataset.theme = saved;
  updateIcons(saved);

  ['themeToggle', 'themeToggleMob'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
      html.dataset.theme = next;
      localStorage.setItem('fi-theme', next);
      updateIcons(next);
    });
  });

  function updateIcons(theme) {
    ['themeIcon', 'themeIconMob'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    });
  }
}

// ── Music ────────────────────────────────────────────────────────────────────
function initMusic() {
  const btn   = document.getElementById('musicToggle');
  const audio = document.getElementById('bgMusic');
  if (!btn || !audio) return;
  audio.volume = 0.15;
  let playing  = false;
  btn.addEventListener('click', () => {
    playing ? audio.pause() : audio.play().catch(() => {});
    playing = !playing;
    btn.style.color = playing ? 'var(--gold)' : '';
  });
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────
function initSocket() {
  if (typeof io === 'undefined') return;
  const socket = io({ transports: ['websocket', 'polling'] });
  const chip   = document.getElementById('visitorChip');
  const count  = document.getElementById('visitorCount');
  const toast  = document.getElementById('newSigToast')
                   ? new bootstrap.Toast(document.getElementById('newSigToast'), { delay: 4000 })
                   : null;
  const toastMsg = document.getElementById('toastMsg');

  socket.on('visitor_update', d => {
    if (count) count.textContent = d.count;
    if (chip)  chip.style.display = 'flex';
  });

  socket.on('new_signature', d => {
    if (toastMsg) toastMsg.textContent = `✨ ${d.name} just signed!`;
    toast?.show();
    const el = document.getElementById('totalSigs');
    if (el) el.textContent = parseInt(el.textContent || 0) + 1;
  });
}

// ── Particles ─────────────────────────────────────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    if (!particles) createParticles();
  }
  function createParticles() {
    const n = Math.min(Math.floor((W * H) / 9000), 80);
    particles = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.6 + 0.3,
      dx: (Math.random() - 0.5) * 0.35,
      dy: -Math.random() * 0.45 - 0.1,
      a: Math.random(),
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(226,201,126,${p.a * 0.65})`;
      ctx.fill();
      p.x += p.dx; p.y += p.dy;
      p.a += (Math.random() - 0.5) * 0.01;
      p.a  = Math.max(0.1, Math.min(0.9, p.a));
      if (p.y < -5)  p.y = H + 5;
      if (p.x < -5)  p.x = W + 5;
      if (p.x > W+5) p.x = -5;
    });
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize(); draw();
}
window.initParticles = initParticles;

// ── Floating caps ─────────────────────────────────────────────────────────────
function initFloatingCaps() {
  document.querySelectorAll('.fc').forEach(el => {
    el.style.bottom           = `-${Math.random() * 20 + 5}%`;
    el.style.animationDuration = `${10 + Math.random() * 10}s`;
    el.style.animationDelay   = `${Math.random() * 14}s`;
    el.style.fontSize         = `${1 + Math.random() * 2}rem`;
    el.style.opacity          = `${0.06 + Math.random() * 0.1}`;
  });
}

// ── Confetti ──────────────────────────────────────────────────────────────────
window.launchConfetti = function () {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx  = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const COLORS = ['#e2c97e','#f0dfa0','#c0392b','#9b59b6','#3498db','#2ecc71','#fff'];
  const pieces = Array.from({ length: 170 }, () => ({
    x:  Math.random() * canvas.width,
    y:  Math.random() * canvas.height - canvas.height,
    w:  Math.random() * 10 + 5, h: Math.random() * 5 + 3,
    c:  COLORS[Math.floor(Math.random() * COLORS.length)],
    r:  Math.random() * Math.PI * 2,
    dr: (Math.random() - 0.5) * 0.14,
    dx: (Math.random() - 0.5) * 2,
    dy: Math.random() * 4 + 2, a: 1,
  }));
  let frame = 0;
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.globalAlpha = p.a;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
      p.x += p.dx; p.y += p.dy; p.r += p.dr;
      if (frame > 100) p.a -= 0.013;
    });
    frame++;
    if (frame < 230) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  tick();
};
