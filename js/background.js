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
    constellations = [];
  }

  function createParticle() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 0.3 + 0.05,
      alpha: Math.random() * 0.5 + 0.1,
      // Глубина слоя: дальние звёзды почти не реагируют на мышь, ближние — заметно
      depth: 0.15 + Math.random() ** 2 * 0.85,
      // Счётчик перерождений — по нему созвездия понимают, что звезда улетела
      gen: 0,
      gravX: 0,
      gravY: 0,
      gravVX: 0,
      gravVY: 0,
    };
  }

  // Параллакс и гравитация от курсора
  const PARALLAX_MAX = 26;
  const GRAVITY_RADIUS = 110;
  const GRAVITY_STRENGTH = 1.15;
  let parallaxTargetX = 0;
  let parallaxTargetY = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let mouseX = -1000;
  let mouseY = -1000;

  const finePointer = !reducedMotion && matchMedia('(pointer: fine)').matches;

  if (finePointer) {
    window.addEventListener('pointermove', (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      parallaxTargetX = (event.clientX / width - 0.5) * -2 * PARALLAX_MAX;
      parallaxTargetY = (event.clientY / height - 0.5) * -2 * PARALLAX_MAX;
    }, { passive: true });
  }

  function particleScreenPos(p) {
    const margin = PARALLAX_MAX + GRAVITY_RADIUS;
    const x = p.x + parallaxX * p.depth + p.gravX;
    const y = p.y + parallaxY * p.depth + p.gravY;
    return {
      x: (((x % (width + margin * 2)) + width + margin * 2) % (width + margin * 2) - margin),
      y,
    };
  }

  function applyGravity() {
    if (mouseX < 0) return;

    for (const p of particles) {
      const { x, y } = particleScreenPos(p);
      const dx = x - mouseX;
      const dy = y - mouseY;
      const dist = Math.hypot(dx, dy);

      if (dist < GRAVITY_RADIUS && dist > 2) {
        const force = (1 - dist / GRAVITY_RADIUS) ** 1.5 * GRAVITY_STRENGTH * p.depth;
        p.gravVX += (dx / dist) * force;
        p.gravVY += (dy / dist) * force;
      }

      p.gravVX *= 0.86;
      p.gravVY *= 0.86;
      p.gravX += p.gravVX;
      p.gravY += p.gravVY;
      p.gravX *= 0.93;
      p.gravY *= 0.93;
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /*
   * Туманности: огромные размытые цветные пятна, медленно дрейфующие
   * по лиссажу-траекториям. Первое пятно красится в цвет темы,
   * остальные — в фиксированные глубокие оттенки для объёма.
   */
  const NEBULAE = [
    { bx: 0.24, by: 0.32, r: 0.52, ax: 0.1, ay: 0.07, fx: 0.021, fy: 0.016, phase: 0, alpha: 0.075, tint: null },
    { bx: 0.76, by: 0.6, r: 0.46, ax: 0.08, ay: 0.1, fx: 0.014, fy: 0.022, phase: 2.2, alpha: 0.06, tint: '139, 92, 246' },
    { bx: 0.52, by: 0.88, r: 0.42, ax: 0.11, ay: 0.06, fx: 0.017, fy: 0.012, phase: 4.4, alpha: 0.05, tint: '30, 90, 200' },
  ];

  function drawNebulae(timeSec, rgb) {
    const scale = Math.max(width, height);

    for (const n of NEBULAE) {
      const cx = (n.bx + Math.sin(timeSec * n.fx + n.phase) * n.ax) * width;
      const cy = (n.by + Math.cos(timeSec * n.fy + n.phase) * n.ay) * height;
      const r = n.r * scale;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(${n.tint ?? rgb}, ${n.alpha})`);
      grad.addColorStop(0.55, `rgba(${n.tint ?? rgb}, ${n.alpha * 0.45})`);
      grad.addColorStop(1, 'rgba(8, 8, 15, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
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

  /*
   * Созвездия: при бездействии ближайшие звёзды тихо соединяются линиями,
   * при движении мыши — распадаются. Если звезда-участница «переродилась»
   * (улетела за верхний край и заспавнилась внизу), созвездие тоже гаснет.
   */
  const IDLE_DELAY = 8000;
  const CONSTELLATION_MAX = 3;
  const CONSTELLATION_LIFETIME = 25000;
  let constellations = [];
  let nextConstellationAt = 0;
  let lastActivity = performance.now();

  const markActivity = () => {
    lastActivity = performance.now();
  };

  window.addEventListener('pointermove', markActivity, { passive: true });
  window.addEventListener('pointerdown', markActivity, { passive: true });
  window.addEventListener('wheel', markActivity, { passive: true });

  function starPos(p) {
    return particleScreenPos(p);
  }

  function buildConstellation() {
    // Сид подальше от краёв, чтобы линии не обрезались и звёзды не скоро переродились
    const candidates = particles.filter(
      (p) => p.y > height * 0.2 && p.y < height * 0.9 && p.x > width * 0.1 && p.x < width * 0.9,
    );
    if (candidates.length < 5) return null;

    const seed = candidates[Math.floor(Math.random() * candidates.length)];
    const maxDist = Math.min(width, height) * 0.28;

    const neighbours = candidates
      .filter((p) => p !== seed)
      .map((p) => ({ p, d: Math.hypot(p.x - seed.x, p.y - seed.y) }))
      .filter(({ d }) => d < maxDist)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3 + Math.floor(Math.random() * 4))
      .map(({ p }) => p);

    if (neighbours.length < 3) return null;

    // Жадная цепочка «от ближайшей к ближайшей» — похоже на рисунок созвездия
    const chain = [seed];
    const rest = [...neighbours];
    while (rest.length) {
      const last = chain[chain.length - 1];
      let bestIdx = 0;
      let bestD = Infinity;
      rest.forEach((p, i) => {
        const d = Math.hypot(p.x - last.x, p.y - last.y);
        if (d < bestD) {
          bestD = d;
          bestIdx = i;
        }
      });
      chain.push(rest.splice(bestIdx, 1)[0]);
    }

    return {
      stars: chain,
      gens: chain.map((p) => p.gen),
      alpha: 0,
      dying: false,
      bornAt: performance.now(),
    };
  }

  function drawConstellations(now, rgb) {
    const idle = now - lastActivity > IDLE_DELAY;

    if (idle && constellations.length < CONSTELLATION_MAX && now >= nextConstellationAt) {
      const c = buildConstellation();
      if (c) constellations.push(c);
      nextConstellationAt = now + 4000 + Math.random() * 3000;
    }

    for (let i = constellations.length - 1; i >= 0; i--) {
      const c = constellations[i];

      const broken = c.stars.some((p, idx) => p.gen !== c.gens[idx]);
      if (!idle || broken || now - c.bornAt > CONSTELLATION_LIFETIME) {
        c.dying = true;
      }

      c.alpha = c.dying ? c.alpha - 0.025 : Math.min(0.55, c.alpha + 0.006);
      if (c.alpha <= 0) {
        constellations.splice(i, 1);
        continue;
      }

      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${rgb}, ${c.alpha * 0.55})`;
      ctx.beginPath();
      c.stars.forEach((p, idx) => {
        const { x, y } = starPos(p);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      for (const p of c.stars) {
        const { x, y } = starPos(p);
        ctx.beginPath();
        ctx.arc(x, y, p.radius + 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${c.alpha * 0.8})`;
        ctx.fill();
      }
    }
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
    parallaxX = lerp(parallaxX, parallaxTargetX, 0.06);
    parallaxY = lerp(parallaxY, parallaxTargetY, 0.06);

    const rgb = `${currentColor.r | 0}, ${currentColor.g | 0}, ${currentColor.b | 0}`;

    drawNebulae(performance.now() / 1000, rgb);

    if (finePointer) applyGravity();

    for (const p of particles) {
      if (!reducedMotion) {
        p.y -= p.speed;
        if (p.y < -4) {
          p.y = height + 4;
          p.x = Math.random() * width;
          p.gen += 1;
          p.gravX = 0;
          p.gravY = 0;
          p.gravVX = 0;
          p.gravVY = 0;
        }
      }

      const { x: px, y: py } = particleScreenPos(p);

      ctx.beginPath();
      ctx.arc(px, py, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb}, ${p.alpha})`;
      ctx.fill();
    }

    if (!reducedMotion) {
      const now = performance.now();
      drawConstellations(now, rgb);
      drawMeteors(now, rgb);
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
    drawNebulae(0, `${currentColor.r | 0}, ${currentColor.g | 0}, ${currentColor.b | 0}`);
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
