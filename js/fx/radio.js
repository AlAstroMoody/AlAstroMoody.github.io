import { getViewportSize } from '../viewport.js';

const BAR_COUNT = 180;
const BUFFER_LENGTH = 64;
const FRAME_INTERVAL = 1000 / 30;
const INTENSITY = 0.55;
const PROJECT_ID = 'radio';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let rafId = 0;
let running = false;
let canvas = null;
let ctx = null;
let width = 0;
let height = 0;
let centerX = 0;
let centerY = 0;
let innerRadius = 48;
let resizeHandler = null;
let layoutHandler = null;
let planetBody = null;
let lastTime = 0;
let phase = 0;

let lastDrawX = NaN;
let lastDrawY = NaN;
let lastDrawRadius = NaN;

const dataArray = new Uint8Array(BUFFER_LENGTH);

function getPlanetBody() {
  if (planetBody?.isConnected) return planetBody;
  planetBody = document.querySelector(`.planet[data-id="${PROJECT_ID}"] .planet__body`);
  return planetBody;
}

function updateCenter() {
  const body = getPlanetBody();
  if (body) {
    const rect = body.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    innerRadius = Math.min(rect.width, rect.height) / 2;
    return;
  }

  const hub = document.querySelector('.hub__core');
  if (hub) {
    const rect = hub.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    innerRadius = Math.min(width, height) * 0.12;
    return;
  }

  const orbit = document.querySelector('.orbit-system');
  if (orbit) {
    const rect = orbit.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    innerRadius = Math.min(width, height) * 0.12;
    return;
  }

  centerX = width / 2;
  centerY = height / 2;
  innerRadius = Math.min(width, height) * 0.12;
}

function resize() {
  if (!canvas) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = getViewportSize();
  width = size.width;
  height = size.height;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  resetDrawAnchor();
  updateCenter();
}

function fillSyntheticData(time) {
  phase = time * 0.002;

  for (let i = 0; i < BUFFER_LENGTH; i++) {
    const t = i / BUFFER_LENGTH;
    const wave =
      Math.sin(phase * 3 + t * Math.PI * 6) * 0.35 +
      Math.sin(phase * 1.7 + t * Math.PI * 14) * 0.25 +
      Math.sin(phase * 5.3 + t * Math.PI * 2) * 0.15;

    const noise = reducedMotion ? 0 : (Math.random() - 0.5) * 0.12;
    const value = (0.35 + wave + noise) * 255;
    dataArray[i] = Math.max(20, Math.min(255, value));
  }
}

function drawRadial(context, data, cx, cy) {
  const rads = (Math.PI * 2) / BAR_COUNT;
  const maxBar = Math.min(width, height) * 0.18 * INTENSITY;

  for (let i = 0; i < BAR_COUNT; i++) {
    const value = data[i % BUFFER_LENGTH];
    const barHeight = (value / 255) * maxBar;

    const angle = rads * i;
    const x = cx + Math.cos(angle) * innerRadius;
    const y = cy + Math.sin(angle) * innerRadius;
    const xEnd = cx + Math.cos(angle) * (innerRadius + barHeight);
    const yEnd = cy + Math.sin(angle) * (innerRadius + barHeight);

    const intensity = Math.min(barHeight / 80, 1);
    const alpha = 0.15 + intensity * 0.45;

    context.strokeStyle = `rgba(0, 212, 170, ${alpha})`;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(xEnd, yEnd);
    context.stroke();
  }
}

function centerMoved() {
  if (Number.isNaN(lastDrawX)) return false;
  const moved = Math.hypot(centerX - lastDrawX, centerY - lastDrawY) > 1;
  const resized = Math.abs(innerRadius - lastDrawRadius) > 0.5;
  return moved || resized;
}

function markDrawn() {
  lastDrawX = centerX;
  lastDrawY = centerY;
  lastDrawRadius = innerRadius;
}

function resetDrawAnchor() {
  lastDrawX = NaN;
  lastDrawY = NaN;
  lastDrawRadius = NaN;
}

function drawStatic() {
  updateCenter();
  fillSyntheticData(performance.now());
  drawRadial(ctx, dataArray, centerX, centerY);
  markDrawn();
}

function onLayoutChange() {
  const { width: nextWidth, height: nextHeight } = getViewportSize();
  if (nextWidth !== width || nextHeight !== height) {
    resize();
    return;
  }
  updateCenter();
}

function bindLayoutTracking() {
  layoutHandler = onLayoutChange;
  window.addEventListener('scroll', layoutHandler, { passive: true });
  window.visualViewport?.addEventListener('resize', layoutHandler);
  window.visualViewport?.addEventListener('scroll', layoutHandler);
}

function unbindLayoutTracking() {
  if (!layoutHandler) return;
  window.removeEventListener('scroll', layoutHandler);
  window.visualViewport?.removeEventListener('resize', layoutHandler);
  window.visualViewport?.removeEventListener('scroll', layoutHandler);
  layoutHandler = null;
}

function frame(now) {
  if (!running) return;

  rafId = requestAnimationFrame(frame);
  updateCenter();

  if (centerMoved() && ctx) {
    ctx.clearRect(0, 0, width, height);
  }

  if (now - lastTime < FRAME_INTERVAL) return;
  lastTime = now;

  fillSyntheticData(now);

  // При смещении планеты не оставляем «хвосты» от старого центра
  if (!centerMoved()) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  }

  drawRadial(ctx, dataArray, centerX, centerY);
  markDrawn();
}

export function startRadioFX(targetCanvas) {
  stopRadioFX();
  if (!targetCanvas) return;

  canvas = targetCanvas;
  resize();

  resizeHandler = resize;
  window.addEventListener('resize', resizeHandler);
  bindLayoutTracking();

  if (reducedMotion) {
    drawStatic();
    return;
  }

  running = true;
  lastTime = 0;
  rafId = requestAnimationFrame(frame);
}

export function stopRadioFX() {
  running = false;
  cancelAnimationFrame(rafId);

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  unbindLayoutTracking();
  planetBody = null;
  resetDrawAnchor();

  if (ctx && canvas) {
    ctx.clearRect(0, 0, width, height);
  }

  canvas = null;
  ctx = null;
}
