const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const STAR_WAIT = 820;
const FLASH_MS = 280;
const DECOY_COUNT = 22;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function parseAngle(planet) {
  const raw = planet.style.getPropertyValue('--angle')
    || getComputedStyle(planet).getPropertyValue('--angle');
  return (parseFloat(raw) || 0) * (Math.PI / 180);
}

function orbitRadius(planet, orbitSize) {
  return orbitSize * (planet.classList.contains('planet--outer') ? 0.44 : 0.29);
}

function planetColor(planet) {
  return getComputedStyle(planet).getPropertyValue('--planet-color').trim() || '#6366f1';
}

function getCenter(container) {
  const rect = container.getBoundingClientRect();
  return {
    cx: rect.width / 2,
    cy: rect.height / 2,
    orbitSize: rect.width,
  };
}

function createCanvas(container) {
  const rect = container.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.className = 'intro-burst';
  canvas.width = rect.width;
  canvas.height = rect.height;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  container.appendChild(canvas);
  return { canvas, ctx: canvas.getContext('2d'), rect };
}

export function playFlash(container) {
  return new Promise((resolve) => {
    const { canvas, ctx } = createCanvas(container);
    const { cx, cy, orbitSize } = getCenter(container);
    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const flash = Math.max(0, Math.min(1, 1 - elapsed / FLASH_MS));
      if (flash > 0) {
        const r = Math.max(1, orbitSize * 0.35 * (0.5 + flash * 0.5));
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `rgba(255, 255, 255, ${flash * 0.95})`);
        grad.addColorStop(0.35, `rgba(190, 200, 255, ${flash * 0.55})`);
        grad.addColorStop(1, 'rgba(99, 102, 241, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const ringR = Math.max(0, r * 0.55 * (1 - flash));
        if (ringR > 0) {
          ctx.beginPath();
          ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(180, 190, 255, ${flash * 0.7})`;
          ctx.lineWidth = 2 + flash * 3;
          ctx.stroke();
        }
      }

      if (elapsed < FLASH_MS) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

function spiralPoint(p, cx, cy) {
  const eased = easeOutCubic(Math.min(1, p.t));
  const angle = p.targetAngle + (1 - eased) * p.spiralWinds * Math.PI * 2;
  const radius = p.targetRadius * eased;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
    alpha: 1,
  };
}

function drawTrail(ctx, trail, size, rgb, headAlpha) {
  const dotR = Math.max(0, size * 0.55);
  if (dotR <= 0) return;

  for (let i = 0; i < trail.length; i++) {
    const a = ((i + 1) / trail.length) * 0.35 * headAlpha;
    if (a <= 0) continue;
    ctx.beginPath();
    ctx.arc(trail[i].x, trail[i].y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb}, ${a})`;
    ctx.fill();
  }
}

function drawParticleHead(ctx, x, y, size, rgb, alpha) {
  const r = Math.max(0, size * alpha);
  if (r <= 0) return;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb}, ${alpha * 0.18})`;
  ctx.fill();
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function landPlanet(planetEl) {
  planetEl.classList.add('is-intro-landed');

  const id = planetEl.dataset.id;
  if (!id) return;
  document.querySelector(`.project-card[data-id="${id}"]`)?.classList.add('is-intro-visible');
}

function revealAllCards() {
  document.querySelectorAll('.project-card').forEach((card) => {
    card.classList.add('is-intro-visible');
  });
}

function playSpiralFormation(container, planets) {
  return new Promise((resolve) => {
    const { canvas, ctx } = createCanvas(container);
    const { cx, cy, orbitSize } = getCenter(container);

    const planetParticles = Array.from(planets).map((planetEl) => {
      const color = planetColor(planetEl);
      return {
        kind: 'planet',
        planetEl,
        targetAngle: parseAngle(planetEl),
        targetRadius: orbitRadius(planetEl, orbitSize),
        spiralWinds: (0.55 + Math.random() * 0.75) * (Math.random() > 0.5 ? 1 : -1),
        speed: 0.004 + Math.random() * 0.014,
        size: 2.2 + Math.random() * 1.5,
        rgb: hexToRgb(color.startsWith('#') ? color : '#6366f1'),
        t: -Math.random() * 0.65,
        trail: [],
        landed: false,
      };
    });

    const decoys = Array.from({ length: DECOY_COUNT }, () => ({
      kind: 'decoy',
      targetAngle: Math.random() * Math.PI * 2,
      targetRadius: orbitSize * (0.12 + Math.random() * 0.38),
      spiralWinds: (0.8 + Math.random() * 1.2) * (Math.random() > 0.5 ? 1 : -1),
      speed: 0.009 + Math.random() * 0.007,
      size: 1 + Math.random() * 1.8,
      fadeStart: 0.45 + Math.random() * 0.25,
      t: -Math.random() * 0.25,
      trail: [],
      dead: false,
    }));

    const all = [...planetParticles, ...decoys];
    let frameId = 0;
    const maxDuration = 3400;
    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of all) {
        if (p.dead || p.landed) continue;

        if (p.t < 0) {
          p.t += p.speed * 2;
          continue;
        }

        const prev = spiralPoint(p, cx, cy);
        p.t = Math.min(p.kind === 'decoy' ? 1.15 : 1, p.t + p.speed);
        const pos = spiralPoint(p, cx, cy);

        p.trail.push({ x: prev.x, y: prev.y });
        if (p.trail.length > 10) p.trail.shift();

        let headAlpha = 1;
        if (p.kind === 'decoy') {
          if (p.t > p.fadeStart) {
            headAlpha = Math.max(0, 1 - (p.t - p.fadeStart) / (1 - p.fadeStart));
          }
          if (p.t >= 1 && headAlpha <= 0) p.dead = true;
        }

        if (headAlpha > 0.01) {
          const trailRgb = p.kind === 'planet' ? p.rgb : '220, 210, 180';
          drawTrail(ctx, p.trail, p.size, trailRgb, headAlpha);
          drawParticleHead(
            ctx,
            pos.x,
            pos.y,
            p.size,
            p.kind === 'planet' ? p.rgb : '230, 220, 190',
            headAlpha,
          );
        }

        if (p.kind === 'planet' && p.t >= 1 && !p.landed) {
          p.landed = true;
          landPlanet(p.planetEl);
        }
      }

      const allPlanetsLanded = planetParticles.every((p) => p.landed);
      const decoysDone = decoys.every((p) => p.dead || p.landed);
      const timedOut = elapsed > maxDuration;

      if ((allPlanetsLanded && decoysDone) || timedOut) {
        for (const p of planetParticles) {
          if (!p.landed) landPlanet(p.planetEl);
        }
        canvas.remove();
        resolve();
        return;
      }

      frameId = requestAnimationFrame(frame);
    }

    frameId = requestAnimationFrame(frame);
  });
}

export function playIntro(orbitSystemEl) {
  if (reducedMotion) {
    document.body.classList.remove('is-intro', 'is-intro-burst', 'is-intro-settling');
    document.body.classList.add('is-intro-done');
    orbitSystemEl.querySelectorAll('.planet').forEach((p) => landPlanet(p));
    revealAllCards();
    return Promise.resolve();
  }

  document.body.classList.add('is-intro');
  const planets = orbitSystemEl.querySelectorAll('.planet');

  return new Promise((resolve) => {
    const starTimer = window.setTimeout(async () => {
      document.body.classList.add('is-intro-burst');
      await playFlash(orbitSystemEl);
      document.body.classList.add('is-intro-settling');
      await playSpiralFormation(orbitSystemEl, planets);

      // Даём браузеру отрисовать последние «приземления», пока ещё идёт settling:
      // иначе прыжок --radius-scale 0 → 1 попадёт под transition из is-intro-done,
      // и планета уедет на место из центра, а не появится из точки
      await new Promise((r) => {
        requestAnimationFrame(() => requestAnimationFrame(r));
      });

      document.body.classList.remove('is-intro', 'is-intro-burst', 'is-intro-settling');
      document.body.classList.add('is-intro-done');
      revealAllCards();
      resolve();
    }, STAR_WAIT);

    return () => clearTimeout(starTimer);
  });
}
