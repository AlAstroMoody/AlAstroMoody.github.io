const BAR_COUNT = 180;
const BUFFER_LENGTH = 64;
const FRAME_INTERVAL = 1000 / 30;
const INTENSITY = 0.55;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let rafId = 0;
let running = false;
let canvas = null;
let ctx = null;
let width = 0;
let height = 0;
let centerX = 0;
let centerY = 0;
let resizeHandler = null;
let lastTime = 0;
let phase = 0;

const dataArray = new Uint8Array(BUFFER_LENGTH);

function updateCenter() {
  const hub = document.querySelector('.hub__core');
  if (hub) {
    const rect = hub.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    return;
  }

  const orbit = document.querySelector('.orbit-system');
  if (orbit) {
    const rect = orbit.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    return;
  }

  centerX = width / 2;
  centerY = height / 2;
}

function resize() {
  if (!canvas) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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
  const innerRadius = Math.min(width, height) * 0.12;
  const rads = (Math.PI * 2) / BAR_COUNT;

  for (let i = 0; i < BAR_COUNT; i++) {
    const value = data[i % BUFFER_LENGTH];
    const barHeight = (value / 255) * Math.min(width, height) * 0.18 * INTENSITY;

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

function drawStatic() {
  updateCenter();
  fillSyntheticData(performance.now());
  ctx.fillStyle = 'rgba(8, 8, 15, 0.35)';
  ctx.fillRect(0, 0, width, height);
  drawRadial(ctx, dataArray, centerX, centerY);
}

function frame(now) {
  if (!running) return;

  rafId = requestAnimationFrame(frame);
  if (now - lastTime < FRAME_INTERVAL) return;
  lastTime = now;

  updateCenter();
  fillSyntheticData(now);

  ctx.fillStyle = 'rgba(8, 8, 15, 0.22)';
  ctx.fillRect(0, 0, width, height);
  drawRadial(ctx, dataArray, centerX, centerY);
}

export function startRadioFX(targetCanvas) {
  stopRadioFX();
  if (!targetCanvas) return;

  canvas = targetCanvas;
  resize();

  resizeHandler = resize;
  window.addEventListener('resize', resizeHandler);

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

  if (ctx && canvas) {
    ctx.clearRect(0, 0, width, height);
  }

  canvas = null;
  ctx = null;
}
