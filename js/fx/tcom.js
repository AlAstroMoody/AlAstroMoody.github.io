const FRAME_INTERVAL = 1000 / 30;
const PROJECT_ID = 'tcom';
const PULSE_INTERVAL = 520;
const GLOW_DECAY = 0.9;
const SLOT_SPACING = 4;
const BURST_PARTICLE_COUNT = 24;
const BURST_SPEED_MIN = 0.012;
const BURST_SPEED_MAX = 0.028;
const TRAIL_LENGTH = 6;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Цвета редкости в духе WC3/ARPG: обычный → эпический → легендарный.
const RARITIES = [
  { fill: 'rgba(255, 255, 255, 0.06)', edge: 'rgba(212, 175, 55, 0.45)', glyph: 0.6 },
  { fill: 'rgba(120, 220, 130, 0.07)', edge: 'rgba(120, 220, 130, 0.6)', glyph: 0.7 },
  { fill: 'rgba(110, 175, 255, 0.07)', edge: 'rgba(110, 175, 255, 0.65)', glyph: 0.75 },
  { fill: 'rgba(190, 130, 255, 0.08)', edge: 'rgba(190, 130, 255, 0.7)', glyph: 0.8 },
  { fill: 'rgba(255, 200, 90, 0.09)', edge: 'rgba(255, 200, 90, 0.8)', glyph: 0.9 },
];

// Глифы предметов рисуются примитивами canvas внутри единичного квадрата [-1, 1].
const GLYPHS = [
  drawSword, drawShield, drawPotion, drawRing, drawGem, drawScroll,
  drawAxe, drawBow, drawArmor, drawCrown, drawOrb, drawBoots,
];

let rafId = 0;
let running = false;
let canvas = null;
let ctx = null;
let width = 0;
let height = 0;
let originX = 0;
let originY = 0;
let resizeHandler = null;
let lastTime = 0;
let nextPulseAt = 0;
let queue = [];
let phase = 'burst';
let slots = [];
let visibleSlots = new Set();
let glow = new Map();
let burstParticles = [];

function initCanvas(target, w, h) {
  const context = target.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  target.width = w * dpr;
  target.height = h * dpr;
  target.style.width = '100%';
  target.style.height = '100%';
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  return context;
}

function shuffle(items) {
  const list = items.slice();
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function updateOrigin() {
  const body = document.querySelector(`.planet[data-id="${PROJECT_ID}"] .planet__body`);
  if (body) {
    const rect = body.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top + rect.height / 2;
    return;
  }

  const hub = document.querySelector('.hub__core');
  if (hub) {
    const rect = hub.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top + rect.height / 2;
    return;
  }

  originX = width / 2;
  originY = height / 2; 
}

// Центр панели в верхнем правом углу.
function panelCenter() {
  const cols = width < 640 ? 3 : 4;
  const size = width < 640 ? 34 : width < 1366 ? 40 : 46;
  const step = size + SLOT_SPACING;
  const totalW = cols * step - SLOT_SPACING;
  const totalH = 3 * step - SLOT_SPACING;

  const margin = width < 640 ? 16 : 32;
  const cx = width - margin - totalW / 2;
  const cy = margin + totalH / 2 + 40;

  return { cx, cy, totalW, totalH };
}

function buildLayout() {
  const cols = width < 640 ? 3 : 4;
  const rows = 3;
  const size = width < 640 ? 34 : width < 1366 ? 40 : 46;
  const step = size + SLOT_SPACING;

  const { cx, cy } = panelCenter();
  const left = cx - (cols * step - SLOT_SPACING) / 2;
  const top = cy - (rows * step - SLOT_SPACING) / 2;

  const glyphs = shuffle(GLYPHS);
  let gi = 0;

  slots = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      slots.push({
        col, row,
        x: left + col * step,
        y: top + row * step,
        size,
        glyph: glyphs[gi % glyphs.length],
        rarity: 0,
      });
      gi++;
    }
  }
}

function rarityOf(slot) {
  return RARITIES[slot.rarity];
}

// --- Прорисовка одного слота ---

function drawBevel(slot, alpha) {
  const { x, y, size } = slot;
  const r = rarityOf(slot);
  const bevel = Math.max(2, size * 0.14);

  ctx.save();
  ctx.globalAlpha = alpha;

  const grad = ctx.createRadialGradient(
    x + size / 2, y + size / 2, 0,
    x + size / 2, y + size / 2, size * 0.7,
  );
  grad.addColorStop(0, r.fill);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, size, size);

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(240, 210, 120, ${0.55 * alpha})`;
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.lineTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.stroke();

  ctx.strokeStyle = `rgba(120, 90, 30, ${0.6 * alpha})`;
  ctx.beginPath();
  ctx.moveTo(x + size, y);
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x, y + size);
  ctx.stroke();

  ctx.strokeStyle = r.edge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + bevel * 0.5, y + bevel * 0.5, size - bevel, size - bevel);

  ctx.restore();
}

function drawSelectionFrame(slot, alpha) {
  if (alpha <= 0) return;
  const { x, y, size } = slot;
  const corner = Math.max(4, size * 0.22);
  const inset = 1;

  ctx.save();
  ctx.strokeStyle = `rgba(255, 230, 150, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  const lx = x - inset;
  const ty = y - inset;
  const rx = x + size + inset;
  const by = y + size + inset;

  ctx.beginPath();
  ctx.moveTo(lx, ty + corner); ctx.lineTo(lx, ty); ctx.lineTo(lx + corner, ty);
  ctx.moveTo(rx - corner, ty); ctx.lineTo(rx, ty); ctx.lineTo(rx, ty + corner);
  ctx.moveTo(rx, by - corner); ctx.lineTo(rx, by); ctx.lineTo(rx - corner, by);
  ctx.moveTo(lx + corner, by); ctx.lineTo(lx, by); ctx.lineTo(lx, by - corner);
  ctx.stroke();
  ctx.restore();
}

function drawGlyph(slot, alpha) {
  if (alpha <= 0) return;
  const { x, y, size, glyph } = slot;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const s = size * 0.34;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha * rarityOf(slot).glyph;
  ctx.lineWidth = 0.18;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(245, 230, 200, 0.85)';
  ctx.strokeStyle = 'rgba(245, 230, 200, 0.9)';
  slot.glyph(ctx);
  ctx.restore();
}

function drawSlot(slot, idx) {
  if (!visibleSlots.has(idx)) return;

  const g = glow.get(idx) ?? 0;

  drawBevel(slot, 1);
  drawGlyph(slot, 1);

  if (g > 0) {
    const { x, y, size } = slot;
    const grad = ctx.createRadialGradient(
      x + size / 2, y + size / 2, size * 0.3,
      x + size / 2, y + size / 2, size * 1.1,
    );
    const r = rarityOf(slot);
    grad.addColorStop(0, `rgba(255, 220, 140, ${0.22 * g})`);
    grad.addColorStop(1, r.edge.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = grad;
    ctx.fillRect(x - size * 0.6, y - size * 0.6, size * 2.2, size * 2.2);

    drawSelectionFrame(slot, g);
  }
}

// --- Глифы ---

function drawSword(c) {
  c.beginPath();
  c.moveTo(-0.6, 0.6); c.lineTo(0.6, -0.6);
  c.stroke();
  c.beginPath();
  c.moveTo(-0.8, 0.45); c.lineTo(-0.45, 0.8);
  c.stroke();
  c.beginPath();
  c.moveTo(-0.45, 0.8); c.lineTo(-0.7, 1.0);
  c.stroke();
  c.beginPath();
  c.arc(-0.78, 1.05, 0.1, 0, Math.PI * 2);
  c.fill();
}

function drawShield(c) {
  c.beginPath();
  c.moveTo(-0.6, -0.6); c.lineTo(0.6, -0.6); c.lineTo(0.6, 0.1);
  c.quadraticCurveTo(0.6, 0.9, 0, 1.0);
  c.quadraticCurveTo(-0.6, 0.9, -0.6, 0.1);
  c.closePath();
  c.fill(); c.stroke();
}

function drawPotion(c) {
  c.fillRect(-0.18, -0.9, 0.36, 0.35);
  c.strokeRect(-0.18, -0.9, 0.36, 0.35);
  c.beginPath();
  c.moveTo(-0.18, -0.55); c.lineTo(-0.55, -0.2); c.lineTo(-0.5, 0.55);
  c.quadraticCurveTo(0, 0.95, 0.5, 0.55);
  c.lineTo(0.55, -0.2); c.lineTo(0.18, -0.55);
  c.closePath();
  c.fill(); c.stroke();
}

function drawRing(c) {
  c.beginPath(); c.arc(0, 0, 0.6, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.arc(0, 0, 0.4, 0, Math.PI * 2); c.stroke();
  c.beginPath();
  c.moveTo(0, -0.85); c.lineTo(0.18, -0.6); c.lineTo(-0.18, -0.6);
  c.closePath(); c.fill();
}

function drawGem(c) {
  c.beginPath();
  c.moveTo(0, -0.7); c.lineTo(0.6, -0.15); c.lineTo(0.35, 0.75);
  c.lineTo(-0.35, 0.75); c.lineTo(-0.6, -0.15);
  c.closePath(); c.fill(); c.stroke();
  c.beginPath();
  c.moveTo(-0.6, -0.15); c.lineTo(0.6, -0.15);
  c.moveTo(0, -0.7); c.lineTo(0, 0.75);
  c.stroke();
}

function drawScroll(c) {
  c.fillRect(-0.5, -0.6, 1.0, 1.2);
  c.strokeRect(-0.5, -0.6, 1.0, 1.2);
  c.beginPath(); c.ellipse(-0.5, 0, 0.18, 0.6, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(0.5, 0, 0.18, 0.6, 0, 0, Math.PI * 2); c.fill();
  c.beginPath();
  c.moveTo(-0.3, -0.25); c.lineTo(0.3, -0.25);
  c.moveTo(-0.3, 0.05); c.lineTo(0.3, 0.05);
  c.moveTo(-0.3, 0.35); c.lineTo(0.15, 0.35);
  c.stroke();
}

function drawAxe(c) {
  c.beginPath();
  c.moveTo(0.55, -0.7); c.quadraticCurveTo(0.95, 0, 0.55, 0.6);
  c.lineTo(0.1, 0.35); c.quadraticCurveTo(0.35, 0, 0.1, -0.45);
  c.closePath(); c.fill(); c.stroke();
  c.beginPath();
  c.moveTo(0.1, -0.45); c.lineTo(-0.7, 0.7);
  c.stroke();
}

function drawBow(c) {
  c.beginPath();
  c.arc(0.4, 0, 0.85, Math.PI * 0.62, Math.PI * 1.38);
  c.stroke();
  c.beginPath();
  c.moveTo(-0.35, -0.7); c.lineTo(-0.35, 0.7);
  c.stroke();
  c.beginPath();
  c.moveTo(-0.35, 0); c.lineTo(0.6, 0);
  c.stroke();
  c.beginPath();
  c.moveTo(0.6, 0); c.lineTo(0.45, -0.12);
  c.moveTo(0.6, 0); c.lineTo(0.45, 0.12);
  c.stroke();
}

function drawArmor(c) {
  c.beginPath();
  c.moveTo(0, -0.75); c.lineTo(0.6, -0.45); c.lineTo(0.55, 0.5);
  c.quadraticCurveTo(0, 0.85, -0.55, 0.5);
  c.lineTo(-0.6, -0.45);
  c.closePath(); c.fill(); c.stroke();
  c.beginPath();
  c.moveTo(0, -0.75); c.lineTo(0, 0.7);
  c.stroke();
}

function drawCrown(c) {
  c.beginPath();
  c.moveTo(-0.6, 0.35); c.lineTo(-0.6, -0.1); c.lineTo(-0.35, 0.1);
  c.lineTo(-0.1, -0.4); c.lineTo(0.1, 0.1); c.lineTo(0.35, -0.4);
  c.lineTo(0.6, 0.1); c.lineTo(0.6, 0.35);
  c.closePath(); c.fill(); c.stroke();
  c.beginPath();
  c.arc(-0.35, 0.1, 0.08, 0, Math.PI * 2);
  c.arc(0.1, 0.1, 0.08, 0, Math.PI * 2);
  c.arc(0.35, -0.4, 0.08, 0, Math.PI * 2);
  c.fill();
}

function drawOrb(c) {
  const grad = c.createRadialGradient(-0.2, -0.2, 0.05, 0, 0, 0.6);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(1, 'rgba(170, 200, 255, 0.4)');
  c.fillStyle = grad;
  c.beginPath(); c.arc(0, 0, 0.6, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(245, 230, 200, 0.9)';
  c.stroke();
  c.beginPath();
  c.moveTo(-0.4, 0.55); c.lineTo(0.4, 0.55);
  c.lineTo(0.3, 0.8); c.lineTo(-0.3, 0.8);
  c.closePath(); c.fill(); c.stroke();
}

function drawBoots(c) {
  c.beginPath();
  c.moveTo(-0.6, -0.5); c.lineTo(-0.25, -0.5); c.lineTo(-0.25, 0.55);
  c.lineTo(-0.6, 0.55); c.lineTo(-0.7, 0.4);
  c.closePath(); c.fill(); c.stroke();
  c.beginPath();
  c.moveTo(0.25, -0.5); c.lineTo(0.6, -0.5); c.lineTo(0.7, 0.4);
  c.lineTo(0.6, 0.55); c.lineTo(0.25, 0.55);
  c.closePath(); c.fill(); c.stroke();
}

// --- Выстрел от планеты к панели ---

function createBurstParticles() {
  const { cx, cy } = panelCenter();
  const dx = cx - originX;
  const dy = cy - originY;

  burstParticles = [];
  for (let i = 0; i < BURST_PARTICLE_COUNT; i++) {
    // Небольшой разброс по направлению.
    const spread = (Math.random() - 0.5) * 0.5;
    const angle = Math.atan2(dy, dx) + spread;
    const speed = BURST_SPEED_MIN + Math.random() * (BURST_SPEED_MAX - BURST_SPEED_MIN);
    // Разный старт: немного рассинхронизированные по времени вылета.
    const delay = Math.random() * 0.3;

    burstParticles.push({
      progress: -delay,
      speed,
      angle,
      trail: [],
      size: 1.2 + Math.random() * 2,
    });
  }
}

function updateBurst() {
  for (const p of burstParticles) {
    if (p.progress < 0) {
      p.progress += p.speed;
      continue;
    }
    // Сохраняем предыдущую позицию для следа.
    const prevX = originX + Math.cos(p.angle) * p.progress;
    const prevY = originY + Math.sin(p.angle) * p.progress;
    p.trail.push({ x: prevX, y: prevY });
    if (p.trail.length > TRAIL_LENGTH) p.trail.shift();

    p.progress += p.speed;
  }

  // Проверяем, все ли долетели.
  return burstParticles.some((p) => p.progress < 1.0);
}

function drawBurst() {
  const { cx, cy } = panelCenter();
  const dx = cx - originX;
  const dy = cy - originY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  for (const p of burstParticles) {
    if (p.progress < 0) continue;

    const x = originX + Math.cos(p.angle) * p.progress * dist;
    const y = originY + Math.sin(p.angle) * p.progress * dist;

    // След.
    for (let i = 0; i < p.trail.length; i++) {
      const t = p.trail[i];
      const alpha = ((i + 1) / p.trail.length) * 0.35;
      ctx.beginPath();
      ctx.arc(t.x, t.y, p.size * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 210, 100, ${alpha})`;
      ctx.fill();
    }

    // Основная частица.
    const headAlpha = Math.min(1, 1 - (p.progress - 0.8) * 5);
    if (headAlpha > 0) {
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 230, 150, ${headAlpha})`;
      ctx.fill();

      // Свечение.
      ctx.beginPath();
      ctx.arc(x, y, p.size * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 80, ${headAlpha * 0.15})`;
      ctx.fill();
    }
  }

  // Тонкая линия-«молния» от планеты к точке сбора.
  const frontProgress = burstParticles.reduce((max, p) => Math.max(max, p.progress), 0);
  if (frontProgress > 0) {
    const fx = originX + (cx - originX) * Math.min(frontProgress, 1);
    const fy = originY + (cy - originY) * Math.min(frontProgress, 1);

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = 'rgba(255, 210, 100, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

// --- Сборка и жизнь ---

function createBuildQueue() {
  const indices = shuffle(slots.map((_, i) => i));
  return indices.map((idx) => () => {
    visibleSlots.add(idx);
  });
}

function startPulse() {
  const available = [...visibleSlots];
  if (!available.length) return;

  const idx = available[Math.floor(Math.random() * available.length)];
  const slot = slots[idx];
  if (!slot) return;

  slot.rarity = Math.floor(Math.random() * RARITIES.length);
  glow.set(idx, 1);
}

function updateGlow() {
  let changed = false;
  for (const [idx, g] of glow) {
    const next = g - GLOW_DECAY;
    if (next <= 0) {
      glow.delete(idx);
      slots[idx].rarity = 0;
    } else {
      glow.set(idx, next);
    }
    changed = true;
  }
  return changed;
}

function startBurst() {
  updateOrigin();
  buildLayout();
  visibleSlots = new Set();
  glow = new Map();
  burstParticles = [];
  createBurstParticles();
  phase = 'burst';
  lastTime = performance.now();
}

function startBuild() {
  queue = createBuildQueue();
  phase = 'build';
  nextPulseAt = 0;
  lastTime = performance.now();
}

function drawAll() {
  visibleSlots = new Set(slots.map((_, i) => i));
  glow = new Map();
  updateOrigin();
  buildLayout();
}

function render() {
  ctx.clearRect(0, 0, width, height);

  if (phase === 'burst') {
    drawBurst();
    return;
  }

  slots.forEach((slot, idx) => drawSlot(slot, idx));
}

function frame(now) {
  if (!running) return;

  rafId = requestAnimationFrame(frame);
  if (now - lastTime < FRAME_INTERVAL) return;

  if (phase === 'burst') {
    const stillFlying = updateBurst();
    render();
    lastTime = now;
    if (!stillFlying) {
      startBuild();
    }
    return;
  }

  if (phase === 'live') {
    const changed = updateGlow();
    if (now >= nextPulseAt) {
      startPulse();
      nextPulseAt = now + PULSE_INTERVAL;
    }
    if (changed) render();
    lastTime = now;
    return;
  }

  if (!queue.length) {
    phase = 'live';
    nextPulseAt = now + PULSE_INTERVAL;
    lastTime = now;
    render();
    return;
  }

  const batch = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < batch && queue.length; i++) {
    queue.shift()();
  }

  lastTime = now;
  render();
}

function handleResize() {
  if (!canvas) return;

  ctx = initCanvas(canvas, window.innerWidth, window.innerHeight);
  width = window.innerWidth;
  height = window.innerHeight;

  if (reducedMotion) {
    drawAll();
    render();
    return;
  }

  startBurst();
}

export function startTcomFX(targetCanvas) {
  stopTcomFX();
  if (!targetCanvas) return;

  canvas = targetCanvas;
  ctx = initCanvas(canvas, window.innerWidth, window.innerHeight);
  width = window.innerWidth;
  height = window.innerHeight;

  resizeHandler = handleResize;
  window.addEventListener('resize', resizeHandler);

  if (reducedMotion) {
    drawAll();
    render();
    return;
  }

  running = true;
  startBurst();
  lastTime = 0;
  rafId = requestAnimationFrame(frame);
}

export function stopTcomFX() {
  running = false;
  cancelAnimationFrame(rafId);

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (ctx && canvas) {
    ctx.clearRect(0, 0, width, height);
  }

  canvas = null;
  ctx = null;
  queue = [];
  slots = [];
  visibleSlots = new Set();
  glow = new Map();
  burstParticles = [];
  phase = 'build';
  nextPulseAt = 0;
}
