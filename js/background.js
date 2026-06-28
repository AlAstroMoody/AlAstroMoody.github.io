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
