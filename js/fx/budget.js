const FRAME_INTERVAL = 1000 / 30;
const LIVE_TICK_MS = 200;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let rafId = 0;
let running = false;
let canvas = null;
let ctx = null;
let width = 0;
let height = 0;
let resizeHandler = null;
let lastTime = 0;
let nextLiveTick = 0;
let queue = [];
let grid = null;
let phase = 'build';
let cellStates = new Map();
let updatableKeys = [];

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

function cellKey(col, row) {
  return `${col},${row}`;
}

function gridColor(alpha) {
  return `rgba(34, 197, 94, ${alpha})`;
}

function cellFillColor(positive, alpha) {
  return positive
    ? `rgba(34, 197, 94, ${alpha})`
    : `rgba(248, 113, 113, ${alpha})`;
}

function randomAmount() {
  const value = Math.floor(Math.random() * 48000) + 200;
  const text = value.toLocaleString('ru-RU');
  const positive = Math.random() > 0.42;
  return { text: `${positive ? '+' : '−'}${text}`, positive };
}

function buildGrid() {
  const marginX = Math.max(32, width * 0.04);
  const marginY = Math.max(32, height * 0.06);
  const cell = width < 640 ? 44 : width < 1366 ? 52 : 60;
  const left = marginX;
  const top = marginY;
  const right = width - marginX;
  const bottom = height - marginY;
  const cols = Math.max(4, Math.floor((right - left) / cell));
  const rows = Math.max(4, Math.floor((bottom - top) / cell));

  return {
    left,
    top,
    right: left + cols * cell,
    bottom: top + rows * cell,
    cols,
    rows,
    cell,
  };
}

function cellRect(g, col, row) {
  return {
    x: g.left + col * g.cell,
    y: g.top + row * g.cell,
    w: g.cell,
    h: g.cell,
  };
}

function drawVLine(g, col) {
  const x = g.left + col * g.cell;
  ctx.beginPath();
  ctx.moveTo(x, g.top);
  ctx.lineTo(x, g.bottom);
  ctx.strokeStyle = gridColor(0.14 + Math.random() * 0.08);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawHLine(g, row) {
  const y = g.top + row * g.cell;
  ctx.beginPath();
  ctx.moveTo(g.left, y);
  ctx.lineTo(g.right, y);
  ctx.strokeStyle = gridColor(0.14 + Math.random() * 0.08);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function clearCellInterior(g, col, row) {
  const { x, y, w, h } = cellRect(g, col, row);
  ctx.clearRect(x + 1, y + 1, w - 2, h - 2);
}

function drawCellFill(g, col, row, positive) {
  const { x, y, w, h } = cellRect(g, col, row);
  const pad = 3;
  ctx.fillStyle = cellFillColor(positive, 0.05 + Math.random() * 0.07);
  ctx.fillRect(x + pad, y + pad, w - pad * 2, h - pad * 2);
}

function drawCellBar(g, col, row, ratio, positive) {
  const { x, y, w, h } = cellRect(g, col, row);
  const pad = 8;
  const barW = Math.max(6, (w - pad * 2) * 0.35);
  const barH = (h - pad * 2) * ratio;
  const barX = x + (w - barW) / 2;
  const barY = y + h - pad - barH;

  ctx.fillStyle = cellFillColor(positive, 0.22 + Math.random() * 0.18);
  ctx.fillRect(barX, barY, barW, barH);
}

function drawCellAmount(g, col, row, amount) {
  const { x, y, w, h } = cellRect(g, col, row);
  const size = Math.max(9, g.cell * 0.22);

  ctx.font = `500 ${size}px "DM Sans", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = cellFillColor(amount.positive, 0.45 + Math.random() * 0.25);
  ctx.fillText(amount.text, x + w / 2, y + h / 2);
}

function drawCell(g, col, row, state) {
  clearCellInterior(g, col, row);

  if (state.kind === 'fill') {
    drawCellFill(g, col, row, state.positive);
  } else if (state.kind === 'bar') {
    drawCellBar(g, col, row, state.ratio, state.positive);
  } else if (state.kind === 'amount') {
    drawCellAmount(g, col, row, state);
  }
}

function registerCell(col, row, state) {
  const key = cellKey(col, row);
  cellStates.set(key, state);
  if (state.kind === 'bar' || state.kind === 'amount') {
    if (!updatableKeys.includes(key)) updatableKeys.push(key);
  }
}

function planCellStates(g) {
  cellStates = new Map();
  updatableKeys = [];

  const cells = [];
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.cols; col++) {
      cells.push({ col, row });
    }
  }

  for (const { col, row } of shuffle(cells).slice(0, Math.floor(cells.length * 0.42))) {
    const kind = Math.random();

    if (kind < 0.34) {
      registerCell(col, row, { kind: 'fill', positive: Math.random() > 0.4 });
    } else if (kind < 0.72) {
      registerCell(col, row, {
        kind: 'bar',
        positive: Math.random() > 0.35,
        ratio: 0.2 + Math.random() * 0.7,
      });
    } else {
      registerCell(col, row, { kind: 'amount', ...randomAmount() });
    }
  }
}

function createBuildQueue(g) {
  const steps = [];

  for (let col = 0; col <= g.cols; col++) {
    steps.push(() => drawVLine(g, col));
  }
  for (let row = 0; row <= g.rows; row++) {
    steps.push(() => drawHLine(g, row));
  }

  for (const [key, state] of cellStates) {
    const [col, row] = key.split(',').map(Number);
    steps.push(() => drawCell(g, col, row, state));
  }

  return shuffle(steps);
}

function scheduleLiveTick(now = performance.now()) {
  nextLiveTick = now + LIVE_TICK_MS;
}

function tickLive(g) {
  if (!updatableKeys.length) return;

  const key = updatableKeys[Math.floor(Math.random() * updatableKeys.length)];
  const state = cellStates.get(key);
  const [col, row] = key.split(',').map(Number);

  if (state.kind === 'bar') {
    state.ratio = 0.2 + Math.random() * 0.7;
    state.positive = Math.random() > 0.35;
  } else {
    const amount = randomAmount();
    state.text = amount.text;
    state.positive = amount.positive;
  }

  drawCell(g, col, row, state);
}

function startBuild() {
  ctx.clearRect(0, 0, width, height);
  grid = buildGrid();
  planCellStates(grid);
  queue = createBuildQueue(grid);
  phase = 'build';
  nextLiveTick = 0;
  lastTime = performance.now();
}

function drawAll() {
  ctx.clearRect(0, 0, width, height);
  grid = buildGrid();
  planCellStates(grid);

  for (let col = 0; col <= grid.cols; col++) drawVLine(grid, col);
  for (let row = 0; row <= grid.rows; row++) drawHLine(grid, row);

  for (const [key, state] of cellStates) {
    const [col, row] = key.split(',').map(Number);
    drawCell(grid, col, row, state);
  }
}

function frame(now) {
  if (!running) return;

  rafId = requestAnimationFrame(frame);
  if (now - lastTime < FRAME_INTERVAL) return;

  if (phase === 'live') {
    if (now >= nextLiveTick) {
      tickLive(grid);
      scheduleLiveTick(now);
    }
    lastTime = now;
    return;
  }

  if (!queue.length) {
    phase = 'live';
    scheduleLiveTick(now);
    lastTime = now;
    return;
  }

  const batch = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < batch && queue.length; i++) {
    queue.shift()();
  }

  lastTime = now;
}

function handleResize() {
  if (!canvas) return;

  ctx = initCanvas(canvas, window.innerWidth, window.innerHeight);
  width = window.innerWidth;
  height = window.innerHeight;

  if (reducedMotion) {
    drawAll();
    return;
  }

  startBuild();
}

export function startBudgetFX(targetCanvas) {
  stopBudgetFX();
  if (!targetCanvas) return;

  canvas = targetCanvas;
  ctx = initCanvas(canvas, window.innerWidth, window.innerHeight);
  width = window.innerWidth;
  height = window.innerHeight;

  resizeHandler = handleResize;
  window.addEventListener('resize', resizeHandler);

  if (reducedMotion) {
    drawAll();
    return;
  }

  running = true;
  startBuild();
  lastTime = 0;
  rafId = requestAnimationFrame(frame);
}

export function stopBudgetFX() {
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
  grid = null;
  phase = 'build';
  cellStates = new Map();
  updatableKeys = [];
  nextLiveTick = 0;
}
