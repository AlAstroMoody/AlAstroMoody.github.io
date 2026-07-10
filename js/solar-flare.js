const FLARE_TRAVEL_MS = 420;
const FLARE_SHATTER_MS = 240;

function hubCenter(container) {
  const hub = container.querySelector('.hub__core');
  const cRect = container.getBoundingClientRect();
  const rect = hub.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - cRect.left,
    y: rect.top + rect.height / 2 - cRect.top,
  };
}

function planetCenter(planetEl, container) {
  const body = planetEl.querySelector('.planet__body');
  const cRect = container.getBoundingClientRect();
  const rect = body.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - cRect.left,
    y: rect.top + rect.height / 2 - cRect.top,
  };
}

function parseAccent() {
  const raw = getComputedStyle(document.body).getPropertyValue('--accent').trim();
  if (!raw.startsWith('#')) return '99, 102, 241';
  const n = parseInt(raw.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function spawnDebris(x, y) {
  return Array.from({ length: 16 + Math.floor(Math.random() * 10) }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 4.5;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 0.6 + Math.random() * 2,
      life: 1,
      decay: 0.045 + Math.random() * 0.055,
    };
  });
}

// Протуберанец: дуга от солнца к случайной планете, в конце — осколки
export function playSolarFlare(container) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return Promise.resolve();
  }

  const planets = [...container.querySelectorAll('.planet')];
  if (!planets.length) return Promise.resolve();

  const target = planets[Math.floor(Math.random() * planets.length)];
  const from = hubCenter(container);
  const to = planetCenter(target, container);
  const rgb = parseAccent();

  const rect = container.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.className = 'solar-flare';
  canvas.width = rect.width;
  canvas.height = rect.height;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const bow = (Math.random() > 0.5 ? 1 : -1) * dist * 0.14;
  const ctrl = {
    x: (from.x + to.x) / 2 + perpX * bow,
    y: (from.y + to.y) / 2 + perpY * bow,
  };

  const sparks = Array.from({ length: 10 }, (_, i) => ({
    t: 0.08 + (i / 10) * 0.82,
    size: 1.2 + Math.random() * 2,
  }));

  let debris = [];
  let shatterAt = 0;

  return new Promise((resolve) => {
    const start = performance.now();

    function pointAt(t) {
      const mt = 1 - t;
      return {
        x: mt * mt * from.x + 2 * mt * t * ctrl.x + t * t * to.x,
        y: mt * mt * from.y + 2 * mt * t * ctrl.y + t * t * to.y,
      };
    }

    function drawTrail(ease, alpha) {
      if (ease <= 0 || alpha <= 0.01) return;

      const head = pointAt(ease);
      const tail = pointAt(Math.max(0, ease - 0.35));

      const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      grad.addColorStop(0, `rgba(${rgb}, 0)`);
      grad.addColorStop(0.35, `rgba(${rgb}, ${0.35 * alpha})`);
      grad.addColorStop(1, `rgba(255, 255, 255, ${0.85 * alpha})`);

      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);

      for (let t = 0; t <= ease; t += 0.04) {
        const p = pointAt(t);
        ctx.lineTo(p.x, p.y);
      }

      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5 + ease * 2;
      ctx.stroke();

      for (const s of sparks) {
        if (s.t > ease) continue;
        const p = pointAt(s.t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 230, 180, ${0.5 * alpha})`;
        ctx.fill();
      }
    }

    function drawDebris() {
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.x += d.vx;
        d.y += d.vy;
        d.vx *= 0.96;
        d.vy *= 0.96;
        d.life -= d.decay;

        if (d.life <= 0) {
          debris.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * d.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 240, 200, ${d.life * 0.9})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * d.life * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${d.life * 0.2})`;
        ctx.fill();
      }
    }

    function frame(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (elapsed < FLARE_TRAVEL_MS) {
        const progress = elapsed / FLARE_TRAVEL_MS;
        const ease = 1 - (1 - progress) ** 3;
        const head = pointAt(ease);

        drawTrail(ease, 1);

        ctx.beginPath();
        ctx.arc(head.x, head.y, 4 + ease * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, 0.9)`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(head.x, head.y, 10 + ease * 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, 0.25)`;
        ctx.fill();

        requestAnimationFrame(frame);
        return;
      }

      if (!shatterAt) {
        shatterAt = now;
        debris = spawnDebris(to.x, to.y);
      }

      const shatterElapsed = now - shatterAt;
      const shatterT = shatterElapsed / FLARE_SHATTER_MS;
      const trailFade = Math.max(0, 1 - shatterT * 2.2);

      drawTrail(1, trailFade);
      drawDebris();

      if (shatterT < 1) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}
