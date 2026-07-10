const THEME_PARTICLES = {
  default: { r: 99, g: 102, b: 241 },
  poe: { r: 201, g: 162, b: 39 },
  radio: { r: 0, g: 212, b: 170 },
  weather: { r: 56, g: 189, b: 248 },
  budget: { r: 34, g: 197, b: 94 },
  gs: { r: 249, g: 115, b: 22 },
  'pwa-magic': { r: 232, g: 121, b: 249 },
  tcom: { r: 202, g: 138, b: 4 },
};

export function initBackground(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { setTheme: () => {} };

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0;
  let height = 0;
  let particles = [];
  let theme = 'default';
  let targetColor = THEME_PARTICLES.default;
  let currentColor = { ...THEME_PARTICLES.default };
  let rafId = 0;
  let paused = false;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    const count = reducedMotion ? 40 : Math.min(120, Math.floor(width * height / 12000));
    particles = Array.from({ length: count }, () => createParticle());
  }

  function createParticle() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 0.3 + 0.05,
      alpha: Math.random() * 0.5 + 0.1,
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  let meteors = [];
  let nextMeteorAt = performance.now() + 1500;

  function spawnMeteor(now) {
    const goingRight = Math.random() > 0.35;
    const angle = (goingRight ? 0.35 : Math.PI - 0.35) + (Math.random() - 0.5) * 0.25;
    const speed = 6 + Math.random() * 5;

    meteors.push({
      x: Math.random() * width,
      y: -20 + Math.random() * height * 0.35,
      vx: Math.cos(angle) * speed,
      vy: Math.abs(Math.sin(angle)) * speed * 0.6 + 2,
      len: 60 + Math.random() * 90,
      life: 1,
      decay: 0.008 + Math.random() * 0.006,
    });

    nextMeteorAt = now + 2500 + Math.random() * 6500;
  }

  function drawMeteors(now, rgb) {
    if (now >= nextMeteorAt && meteors.length < 3) spawnMeteor(now);

    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.x += m.vx;
      m.y += m.vy;
      m.life -= m.decay;

      if (m.life <= 0 || m.y > height + m.len || m.x < -m.len || m.x > width + m.len) {
        meteors.splice(i, 1);
        continue;
      }

      const norm = Math.hypot(m.vx, m.vy);
      const tx = m.x - (m.vx / norm) * m.len;
      const ty = m.y - (m.vy / norm) * m.len;
      const fade = Math.min(1, m.life * 2);

      const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
      grad.addColorStop(0, `rgba(255, 255, 255, ${fade * 0.9})`);
      grad.addColorStop(0.25, `rgba(${rgb}, ${fade * 0.55})`);
      grad.addColorStop(1, `rgba(${rgb}, 0)`);

      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${fade * 0.9})`;
      ctx.fill();
    }
  }

  function tickColor() {
    currentColor.r = lerp(currentColor.r, targetColor.r, 0.04);
    currentColor.g = lerp(currentColor.g, targetColor.g, 0.04);
    currentColor.b = lerp(currentColor.b, targetColor.b, 0.04);
  }

  function draw() {
    rafId = requestAnimationFrame(draw);
    if (paused) return;

    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createRadialGradient(
      width * 0.5, height * 0.35, 0,
      width * 0.5, height * 0.35, Math.max(width, height) * 0.7,
    );
    gradient.addColorStop(0, `rgba(${currentColor.r | 0}, ${currentColor.g | 0}, ${currentColor.b | 0}, 0.12)`);
    gradient.addColorStop(1, 'rgba(8, 8, 15, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    tickColor();

    const rgb = `${currentColor.r | 0}, ${currentColor.g | 0}, ${currentColor.b | 0}`;

    for (const p of particles) {
      if (!reducedMotion) {
        p.y -= p.speed;
        if (p.y < -4) {
          p.y = height + 4;
          p.x = Math.random() * width;
        }
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb}, ${p.alpha})`;
      ctx.fill();
    }

    if (!reducedMotion) {
      drawMeteors(performance.now(), rgb);
    }
  }

  function setTheme(themeId) {
    theme = themeId ?? 'default';
    targetColor = THEME_PARTICLES[theme] ?? THEME_PARTICLES.default;
  }

  resize();
  if (!reducedMotion) {
    draw();
  } else {
    setTheme('default');
    tickColor();
    ctx.fillStyle = `rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, 0.08)`;
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, `rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, 0.15)`);
    gradient.addColorStop(1, 'rgba(8, 8, 15, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  window.addEventListener('resize', resize);

  return {
    setTheme,
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    },
  };
}
