import { projects } from './projects.js';
import { initOrbit, renderProjectList, setTheme, applyHashTheme, THEME_COLORS } from './orbit.js';
import { initBackground } from './background.js';
import { setProjectFx, FX_PROJECTS } from './fx/index.js';
import { playIntro } from './intro.js';
import { initAbout } from './about.js';
import { initComet } from './comet.js';
import { withThemeTransition } from './theme-transition.js';
import { playWarp } from './warp.js';

const planetsEl = document.getElementById('planets');
const listEl = document.getElementById('projects-list');
const orbitSystemEl = document.getElementById('orbit-system');
const bgCanvas = document.getElementById('bg');

const bg = initBackground(bgCanvas);
let activeProjectId = null;
let fxTimer = 0;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchOnly = matchMedia('(hover: none)').matches;

// FX, которые рисуют собственный непрозрачный фон — под ними звёзды не нужны
const FX_OPAQUE = new Set(['weather']);

function applyProjectState(project) {
  setTheme(project.theme);

  if (FX_PROJECTS.has(project.id)) {
    document.body.classList.add('fx-active');

    if (FX_OPAQUE.has(project.id)) {
      bg.pause();
      document.body.classList.add('fx-opaque');
    } else {
      bg.setTheme(project.theme);
      bg.resume();
      document.body.classList.remove('fx-opaque');
    }
  } else {
    bg.setTheme(project.theme);
    bg.resume();
    document.body.classList.remove('fx-active', 'fx-ready', 'fx-opaque');
  }

  history.replaceState(null, '', `#${project.id}`);
}

function scheduleFx(projectId, delay = 120) {
  clearTimeout(fxTimer);
  fxTimer = window.setTimeout(() => setProjectFx(projectId), delay);
}

function showProject(id, originEl, { animate = true } = {}) {
  const project = projects.find((p) => p.id === id);
  if (!project) return;
  if (id === activeProjectId && animate) return;

  activeProjectId = id;

  syncCards(project.id);
  orbit.select(project.id);

  withThemeTransition(() => applyProjectState(project));
  scheduleFx(project.id, animate ? 120 : 0);
}

function navigateToProject(id, originEl) {
  const project = projects.find((p) => p.id === id);
  if (!project) return;

  showProject(id, originEl, { animate: false });

  const colors = THEME_COLORS[project.theme] ?? THEME_COLORS.poe;

  if (!touchOnly && !reducedMotion) {
    playWarp(colors.color).then(() => {
      window.location.assign(project.url);
    });
    return;
  }

  window.location.assign(project.url);
}

const orbit = initOrbit(planetsEl, projects, {
  onHover: showProject,
  onNavigate: navigateToProject,
});

renderProjectList(listEl, projects, {
  onHover: showProject,
  onNavigate: navigateToProject,
});

initAbout(orbitSystemEl);
initComet();

function syncCards(activeId) {
  document.querySelectorAll('.project-card').forEach((card) => {
    card.classList.toggle('is-active', card.dataset.id === activeId);
  });
}

const fromHash = applyHashTheme(projects);

async function start() {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  await playIntro(orbitSystemEl);
  if (fromHash) {
    showProject(fromHash.id, null, { animate: false });
  }
}

start();

window.addEventListener('hashchange', () => {
  const project = applyHashTheme(projects);
  if (project) showProject(project.id, null, { animate: false });
});
