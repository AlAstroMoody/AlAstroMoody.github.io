const r15 = Math.PI / 12;
const { random } = Math;
const FRAME_INTERVAL = 1000 / 30;
const PROJECT_ID = 'gs';

let rafId = 0;
let running = false;
let canvas = null;
let ctx = null;
let canvasWidth = 0;
let canvasHeight = 0;
let originX = 0;
let originY = 0;
let resizeHandler = null;
let steps = [];
let prevSteps = [];
let iterations = 0;
let lastTime = 0;

const INIT_DEPTH = 4;
const BRANCH_LENGTH = 6;

function branchColor() {
  const mix = random();
  const r = Math.round(148 + mix * 38);
  const g = Math.round(58 + mix * 30);
  const b = Math.round(12 + mix * 12);
  return `rgb(${r}, ${g}, ${b})`;
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

  originX = canvasWidth / 2;
  originY = canvasHeight / 2;
}

function initCanvas(target, width, height) {
  const context = target.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const bsr =
    context.webkitBackingStorePixelRatio ||
    context.mozBackingStorePixelRatio ||
    context.msBackingStorePixelRatio ||
    context.oBackingStorePixelRatio ||
    context.backingStorePixelRatio ||
    1;
  const dpi = dpr / bsr;

  target.width = dpi * width;
  target.height = dpi * height;
  target.style.width = '100%';
  target.style.height = '100%';
  context.scale(dpi, dpi);

  return context;
}

function polar2cart(x, y, r, theta) {
  return [x + r * Math.cos(theta), y + r * Math.sin(theta)];
}

function branchStep(x, y, rad) {
  const length = random() * BRANCH_LENGTH;
  const [nx, ny] = polar2cart(x, y, length, rad);

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(nx, ny);
  ctx.strokeStyle = branchColor();
  ctx.lineWidth = random() * 1.2 + 0.8;
  ctx.globalAlpha = random() * 0.6 + 0.3;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const rad1 = rad + random() * r15;
  const rad2 = rad - random() * r15;

  if (nx < -100 || nx > canvasWidth + 100 || ny < -100 || ny > canvasHeight + 100) return;

  if (iterations <= INIT_DEPTH || random() > 0.5) steps.push(() => branchStep(nx, ny, rad1));
  if (iterations <= INIT_DEPTH || random() > 0.5) steps.push(() => branchStep(nx, ny, rad2));
}

function createSeedSteps() {
  updateOrigin();

  const count = canvasWidth < 500 ? 2 : 3;
  const seeds = [];

  for (let i = 0; i < count; i++) {
    const rad = ((Math.PI * 2) / count) * i + (random() - 0.5) * 0.6;
    seeds.push(() => branchStep(originX, originY, rad));
  }

  return seeds;
}

function frame() {
  if (!running) return;

  if (performance.now() - lastTime < FRAME_INTERVAL) {
    rafId = requestAnimationFrame(frame);
    return;
  }

  iterations += 1;
  prevSteps = steps;
  steps = [];
  lastTime = performance.now();

  // Рост завершён: оставляем картинку и не перезапускаем цикл
  if (!prevSteps.length) return;

  prevSteps.forEach((fn) => fn());
  rafId = requestAnimationFrame(frame);
}

function restartGrowth() {
  iterations = 0;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.lineWidth = 1;
  prevSteps = [];
  steps = createSeedSteps();
  lastTime = performance.now();

  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}

function handleResize() {
  if (!canvas) return;

  ctx = initCanvas(canvas, window.innerWidth, window.innerHeight);
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;
  updateOrigin();
  restartGrowth();
}

export function startGsFX(targetCanvas) {
  stopGsFX();

  if (!targetCanvas) return;

  canvas = targetCanvas;
  ctx = initCanvas(canvas, window.innerWidth, window.innerHeight);
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;
  updateOrigin();

  resizeHandler = handleResize;
  window.addEventListener('resize', resizeHandler);

  running = true;
  restartGrowth();
}

export function stopGsFX() {
  running = false;
  cancelAnimationFrame(rafId);

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  }

  canvas = null;
  ctx = null;
  steps = [];
  prevSteps = [];
}
