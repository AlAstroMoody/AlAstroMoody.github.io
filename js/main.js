import { projects } from './projects.js';
import { initOrbit, renderProjectList, setTheme, applyHashTheme } from './orbit.js';
import { initBackground } from './background.js';
import { setProjectFx, FX_PROJECTS } from './fx/index.js';
import { playIntro } from './intro.js';
import { initAbout } from './about.js';
import { initComet } from './comet.js';

const planetsEl = document.getElementById('planets');
const listEl = document.getElementById('projects-list');
const orbitSystemEl = document.getElementById('orbit-system');
const bgCanvas = document.getElementById('bg');

const bg = initBackground(bgCanvas);
let activeProjectId = null;

// FX, которые рисуют собственный непрозрачный фон — под ними звёзды не нужны
const FX_OPAQUE = new Set(['weather']);

function showProject(id) {
  const project = projects.find((p) => p.id === id);
  if (!project || id === activeProjectId) return;

  activeProjectId = id;

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

  setProjectFx(project.id);
  syncCards(project.id);
  orbit.select(project.id);
  history.replaceState(null, '', `#${project.id}`);
}

const orbit = initOrbit(planetsEl, projects, {
  onSelect: showProject,
});

renderProjectList(listEl, projects, {
  onHover: showProject,
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
    showProject(fromHash.id);
  }
}

start();

window.addEventListener('hashchange', () => {
  const project = applyHashTheme(projects);
  if (project) showProject(project.id);
});
