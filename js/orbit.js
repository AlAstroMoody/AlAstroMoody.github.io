import { initProjectCards } from './masonry.js';

const THEME_COLORS = {
  poe: { color: '#c9a227', glow: 'rgba(201, 162, 39, 0.5)' },
  radio: { color: '#00d4aa', glow: 'rgba(0, 212, 170, 0.5)' },
  weather: { color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.5)' },
  budget: { color: '#22c55e', glow: 'rgba(34, 197, 94, 0.5)' },
  gs: { color: '#f97316', glow: 'rgba(249, 115, 22, 0.5)' },
  'pwa-magic': { color: '#e879f9', glow: 'rgba(232, 121, 249, 0.5)' },
  tcom: { color: '#ca8a04', glow: 'rgba(202, 138, 4, 0.5)' },
};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function pulsePlanet(planet) {
  if (!planet || reducedMotion) return;

  planet.classList.remove('is-pulse');
  void planet.offsetWidth;
  planet.classList.add('is-pulse');
}

export function initOrbit(planetsEl, projects, { onSelect }) {
  const fragment = document.createDocumentFragment();

  projects.forEach((project, index) => {
    const colors = THEME_COLORS[project.theme] ?? THEME_COLORS.poe;
    const planet = document.createElement('div');
    planet.className = `planet planet--${project.orbit}`;
    planet.dataset.theme = project.theme;
    planet.dataset.id = project.id;
    planet.style.setProperty('--angle', `${project.angle}deg`);
    planet.style.setProperty('--float-delay', `${index * 0.4}s`);
    planet.style.setProperty('--planet-color', colors.color);
    planet.style.setProperty('--planet-glow', colors.glow);
    planet.style.setProperty('--band-angle', `${((index * 47) % 130) - 55}deg`);
    planet.style.setProperty('--spin-duration', `${18 + (index % 4) * 7}s`);

    const ring = project.rings ? '<span class="planet__ring" aria-hidden="true"></span>' : '';

    planet.innerHTML = `
      <a class="planet__link" href="${project.url}" data-id="${project.id}">
        ${ring}
        <span class="planet__body" aria-hidden="true"></span>
        <span class="planet__label">${project.shortTitle}</span>
        <span class="visually-hidden">${project.title}: ${project.description}</span>
      </a>
    `;

    const link = planet.querySelector('.planet__link');

    link.addEventListener('mouseenter', () => onSelect?.(project.id));
    link.addEventListener('focus', () => onSelect?.(project.id));

    fragment.appendChild(planet);
  });

  planetsEl.appendChild(fragment);

  planetsEl.addEventListener('animationend', (event) => {
    if (event.animationName !== 'planet-wave') return;
    event.target.closest('.planet')?.classList.remove('is-pulse');
  });

  function select(id) {
    planetsEl.querySelectorAll('.planet').forEach((el) => {
      const active = el.dataset.id === id;
      el.classList.toggle('is-active', active);
      if (active) pulsePlanet(el);
      else el.classList.remove('is-pulse');
    });
  }

  return { select };
}

export function renderProjectList(listEl, projects, options) {
  initProjectCards(listEl, projects, options);
}

export function setTheme(themeId) {
  if (themeId) {
    document.body.dataset.theme = themeId;
  } else {
    delete document.body.dataset.theme;
  }
}

export function applyHashTheme(projects) {
  const hash = location.hash.slice(1);
  if (!hash) return null;
  return projects.find((p) => p.id === hash) ?? null;
}
