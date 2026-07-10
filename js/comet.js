const DEFAULT_ACCENT = { r: 99, g: 102, b: 241 };
const MAX_PARTICLES = 240;

function parseAccent(raw) {
  const hex = raw.trim();
  if (!hex.startsWith('#')) return DEFAULT_ACCENT;
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function initComet() {
  const finePointer = matchMedia('(pointer: fine)').matches;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!finePointer || reducedMotion) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'comet-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  let accent = DEFAULT_ACCENT;

  function readAccent() {
    accent = parseAccent(getComputedStyle(document.body).getPropertyValue('--accent'));
  }

  readAccent();
  new MutationObserver(readAccent).observe(document.body, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  const particles = [];
  let headX = 0;
  let headY = 0;
  let lastX = 0;
  let lastY = 0;
  let headAlpha = 0;
  let running = false;

  function spawn(x, y, dx, dy) {
    const speed = Math.hypot(dx, dy);
    const count = Math.min(6, 1 + Math.floor(speed / 8));

    for (let i = 0; i < count; i++) {
      const back = Math.random();
      particles.push({
        x: x - dx * back + (Math.random() - 0.5) * 3,
        y: y - dy * back + (Math.random() - 0.5) * 3,
        vx: -dx * 0.05 + (Math.random() - 0.5) * 0.6,
        vy: -dy * 0.05 + (Math.random() - 0.5) * 0.6,
        r: 0.8 + Math.random() * 1.6,
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
      });
    }

    if (particles.length > MAX_PARTICLES) {
      particles.splice(0, particles.length - MAX_PARTICLES);
    }
  }

  function frame() {
    ctx.clearRect(0, 0, width, height);
    const rgb = `${accent.r}, ${accent.g}, ${accent.b}`;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      const r = p.r * p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb}, ${p.life * 0.12})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.life * 0.5})`;
      ctx.fill();
    }

    headAlpha = Math.max(0, headAlpha - 0.04);
    if (headAlpha > 0.01) {
      const glow = ctx.createRadialGradient(headX, headY, 0, headX, headY, 14);
      glow.addColorStop(0, `rgba(255, 255, 255, ${headAlpha * 0.5})`);
      glow.addColorStop(0.4, `rgba(${rgb}, ${headAlpha * 0.35})`);
      glow.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(headX - 14, headY - 14, 28, 28);
    }

    if (particles.length || headAlpha > 0.01) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, width, height);
      running = false;
    }
  }

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;

    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = headX = event.clientX;
    lastY = headY = event.clientY;
    headAlpha = 1;

    spawn(event.clientX, event.clientY, dx, dy);

    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  }, { passive: true });
}
