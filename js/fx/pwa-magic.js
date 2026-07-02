const FRAME_INTERVAL = 1000 / 30;
const PROJECT_ID = 'pwa-magic';
const PULSE_INTERVAL = 380;
const PULSE_SPEED = 0.045;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const SP = (Math.PI * 2) / 18;

const NODE_DEFS = [
  { id: 'fetch', label: 'fetch', angle: SP * 0 - 1.2, r: 0.17 },
  { id: 'cache', label: 'Cache', angle: SP * 1 - 1.2, r: 0.24 },
  { id: 'sw', label: 'SW', angle: SP * 2 - 1.2, r: 0.15 },
  { id: 'push', label: 'Push', angle: SP * 3 - 1.2, r: 0.28 },
  { id: 'worker', label: 'Worker', angle: SP * 4 - 1.2, r: 0.21 },
  { id: 'idb', label: 'IDB', angle: SP * 5 - 1.2, r: 0.27 },
  { id: 'geo', label: 'Geo', angle: SP * 6 - 1.2, r: 0.19 },
  { id: 'file', label: 'File', angle: SP * 7 - 1.2, r: 0.25 },
  { id: 'share', label: 'Share', angle: SP * 8 - 1.2, r: 0.18 },
  { id: 'clip', label: 'Clip', angle: SP * 9 - 1.2, r: 0.23 },
  { id: 'bt', label: 'BT', angle: SP * 10 - 1.2, r: 0.14 },
  { id: 'sync', label: 'Sync', angle: SP * 11 - 1.2, r: 0.22 },
  { id: 'media', label: 'Media', angle: SP * 12 - 1.2, r: 0.16 },
  { id: 'usb', label: 'USB', angle: SP * 13 - 1.2, r: 0.26 },
  { id: 'crypto', label: 'Crypto', angle: SP * 14 - 1.2, r: 0.20 },
  { id: 'notify', label: 'Notify', angle: SP * 15 - 1.2, r: 0.24 },
  { id: 'sse', label: 'SSE', angle: SP * 16 - 1.2, r: 0.17 },
  { id: 'wake', label: 'Wake', angle: SP * 17 - 1.2, r: 0.21 },
];

const EDGE_DEFS = [
  ['fetch', 'cache'],
  ['cache', 'sw'],
  ['sw', 'push'],
  ['sw', 'worker'],
  ['sw', 'sync'],
  ['worker', 'idb'],
  ['idb', 'crypto'],
  ['fetch', 'file'],
  ['fetch', 'sse'],
  ['sse', 'cache'],
  ['file', 'clip'],
  ['clip', 'share'],
  ['clip', 'sw'],
  ['share', 'geo'],
  ['share', 'bt'],
  ['share', 'media'],
  ['push', 'geo'],
  ['push', 'notify'],
  ['notify', 'sync'],
  ['media', 'usb'],
  ['usb', 'bt'],
  ['geo', 'wake'],
  ['crypto', 'clip'],
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
let phase = 'build';
let nodes = [];
let edges = [];
let visibleSpokes = new Set();
let visibleEdges = new Set();
let visibleNodes = new Set();
let pulses = [];
let nodeGlow = new Map();

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

function accent(alpha) {
  return `rgba(232, 121, 249, ${alpha})`;
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

function layoutGraph() {
  const scale = Math.min(width, height);

  nodes = NODE_DEFS.map((def) => ({
    ...def,
    x: originX + Math.cos(def.angle) * def.r * scale,
    y: originY + Math.sin(def.angle) * def.r * scale,
  }));

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  edges = EDGE_DEFS.map(([from, to]) => ({
    from: byId[from],
    to: byId[to],
  })).filter((e) => e.from && e.to);
}

function nodeById(id) {
  return nodes.find((n) => n.id === id);
}

function drawLine(x1, y1, x2, y2, alpha, widthPx = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = accent(alpha);
  ctx.lineWidth = widthPx;
  ctx.stroke();
}

function drawSpoke(nodeId) {
  const node = nodeById(nodeId);
  if (!node) return;
  drawLine(originX, originY, node.x, node.y, 0.12 + Math.random() * 0.06, 1);
}

function drawEdge(index) {
  const edge = edges[index];
  if (!edge) return;
  drawLine(edge.from.x, edge.from.y, edge.to.x, edge.to.y, 0.18 + Math.random() * 0.08, 1);
}

function drawNode(nodeId) {
  const node = nodeById(nodeId);
  if (!node) return;

  const glow = nodeGlow.get(nodeId) ?? 0;
  const coreR = width < 640 ? 3 : 3.5;

  if (glow > 0) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, coreR + 5, 0, Math.PI * 2);
    ctx.fillStyle = accent(glow * 0.35);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(node.x, node.y, coreR, 0, Math.PI * 2);
  ctx.fillStyle = accent(0.55 + glow * 0.35);
  ctx.fill();

  const fontSize = width < 640 ? 9 : 10;
  ctx.font = `500 ${fontSize}px "DM Sans", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = accent(0.42 + glow * 0.3);
  ctx.fillText(node.label, node.x, node.y + coreR + 4);
}

function render() {
  ctx.clearRect(0, 0, width, height);
  updateOrigin();
  layoutGraph();

  for (const nodeId of visibleSpokes) drawSpoke(nodeId);
  for (const index of visibleEdges) drawEdge(index);

  for (const pulse of pulses) {
    const { edge, t } = pulse;
    const x = edge.from.x + (edge.to.x - edge.from.x) * t;
    const y = edge.from.y + (edge.to.y - edge.from.y) * t;

    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = accent(0.75 * (1 - Math.abs(t - 0.5)));
    ctx.fill();
  }

  for (const nodeId of visibleNodes) drawNode(nodeId);
}

function createBuildQueue() {
  const steps = [];

  for (const node of NODE_DEFS) {
    steps.push(() => {
      visibleSpokes.add(node.id);
      render();
    });
  }

  EDGE_DEFS.forEach((_, index) => {
    steps.push(() => {
      visibleEdges.add(index);
      render();
    });
  });

  for (const node of NODE_DEFS) {
    steps.push(() => {
      visibleNodes.add(node.id);
      render();
    });
  }

  return shuffle(steps);
}

function startPulse() {
  const available = [...visibleEdges];
  if (!available.length) return;

  const index = available[Math.floor(Math.random() * available.length)];
  const edge = edges[index];
  if (!edge) return;

  pulses.push({ edge, t: 0 });
  nodeGlow.set(edge.from.id, 1);

  if (Math.random() > 0.35) {
    nodeGlow.set(edge.to.id, 0.7);
  }
}

function updatePulses() {
  pulses = pulses
    .map((p) => ({ ...p, t: p.t + PULSE_SPEED }))
    .filter((p) => p.t <= 1);

  for (const [id, glow] of nodeGlow) {
    const next = glow - 0.08;
    if (next <= 0) nodeGlow.delete(id);
    else nodeGlow.set(id, next);
  }
}

function startBuild() {
  visibleSpokes = new Set();
  visibleEdges = new Set();
  visibleNodes = new Set();
  pulses = [];
  nodeGlow = new Map();
  queue = createBuildQueue();
  phase = 'build';
  nextPulseAt = 0;
  updateOrigin();
  layoutGraph();
  render();
  lastTime = performance.now();
}

function drawAll() {
  visibleSpokes = new Set(NODE_DEFS.map((n) => n.id));
  visibleEdges = new Set(EDGE_DEFS.map((_, i) => i));
  visibleNodes = new Set(NODE_DEFS.map((n) => n.id));
  pulses = [];
  nodeGlow = new Map();
  updateOrigin();
  layoutGraph();
  render();
}

function frame(now) {
  if (!running) return;

  rafId = requestAnimationFrame(frame);
  if (now - lastTime < FRAME_INTERVAL) return;

  if (phase === 'live') {
    updatePulses();
    if (now >= nextPulseAt) {
      startPulse();
      nextPulseAt = now + PULSE_INTERVAL;
    }
    render();
    lastTime = now;
    return;
  }

  if (!queue.length) {
    phase = 'live';
    nextPulseAt = now + PULSE_INTERVAL;
    lastTime = now;
    return;
  }

  const batch = 2 + Math.floor(Math.random() * 3);
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

export function startPwaMagicFX(targetCanvas) {
  stopPwaMagicFX();
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

export function stopPwaMagicFX() {
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
  nodes = [];
  edges = [];
  visibleSpokes = new Set();
  visibleEdges = new Set();
  visibleNodes = new Set();
  pulses = [];
  nodeGlow = new Map();
  phase = 'build';
  nextPulseAt = 0;
}
