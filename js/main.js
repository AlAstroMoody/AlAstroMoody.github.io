import { projects } from './projects.js';
import { initOrbit, renderProjectList, setTheme, applyHashTheme } from './orbit.js';
import { initBackground } from './background.js';
import { setProjectFx, FX_PROJECTS } from './fx/index.js';

const planetsEl = document.getElementById('planets');
const listEl = document.getElementById('projects-list');
const bgCanvas = document.getElementById('bg');

const bg = initBackground(bgCanvas);
let activeProjectId = null;

function showProject(id) {
  const project = projects.find((p) => p.id === id);
  if (!project || id === activeProjectId) return;

  activeProjectId = id;

  setTheme(project.theme);

  if (FX_PROJECTS.has(project.id)) {
    bg.pause();
    document.body.classList.add('fx-active');
  } else {
    bg.setTheme(project.theme);
    bg.resume();
    document.body.classList.remove('fx-active', 'fx-ready');
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

function syncCards(activeId) {
  document.querySelectorAll('.project-card').forEach((card) => {
    card.classList.toggle('is-active', card.dataset.id === activeId);
  });
}

const fromHash = applyHashTheme(projects);
if (fromHash) {
  showProject(fromHash.id);
}

window.addEventListener('hashchange', () => {
  const project = applyHashTheme(projects);
  if (project) showProject(project.id);
});
