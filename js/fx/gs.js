const r180 = Math.PI;
const r90 = Math.PI / 2;
const r15 = Math.PI / 12;
const { random } = Math;
const FRAME_INTERVAL = 1000 / 30;

let rafId = 0;
let running = false;
let canvas = null;
let ctx = null;
let canvasWidth = 0;
let canvasHeight = 0;
let resizeHandler = null;
let steps = [];
let prevSteps = [];
let iterations = 0;
let lastTime = 0;

const INIT_DEPTH = 4;
const BRANCH_LENGTH = 6;

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
  ctx.strokeStyle = '#4a4a8a';
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
  const seeds = [
    () => branchStep(random() * canvasWidth, 0, r90),
    () => branchStep(random() * canvasWidth, canvasHeight, -r90),
    () => branchStep(0, random() * canvasHeight, 0),
    () => branchStep(canvasWidth, random() * canvasHeight, r180),
  ];
  return canvasWidth < 500 ? seeds.slice(0, 2) : seeds;
}

function frame() {
  if (!running) return;

  rafId = requestAnimationFrame(frame);

  if (performance.now() - lastTime < FRAME_INTERVAL) return;

  iterations += 1;
  prevSteps = steps;
  steps = [];
  lastTime = performance.now();

  if (!prevSteps.length) {
    restartGrowth();
    return;
  }

  prevSteps.forEach((fn) => fn());
}

function restartGrowth() {
  iterations = 0;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.lineWidth = 1;
  prevSteps = [];
  steps = createSeedSteps();
  lastTime = performance.now();
}

function handleResize() {
  if (!canvas) return;

  ctx = initCanvas(canvas, window.innerWidth, window.innerHeight);
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;
  restartGrowth();
}

export function startGsFX(targetCanvas) {
  stopGsFX();

  if (!targetCanvas) return;

  canvas = targetCanvas;
  ctx = initCanvas(canvas, window.innerWidth, window.innerHeight);
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;

  resizeHandler = handleResize;
  window.addEventListener('resize', resizeHandler);

  running = true;
  restartGrowth();
  rafId = requestAnimationFrame(frame);
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
