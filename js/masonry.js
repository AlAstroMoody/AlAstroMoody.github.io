function getColumnCount(listEl) {
  if (window.matchMedia('(min-width: 1366px)').matches) return 2;
  const width = listEl.clientWidth || window.innerWidth;
  if (width >= 400) return 2;
  return 1;
}

function createProjectCard(project) {
  const card = document.createElement('a');
  card.className = 'project-card';
  card.href = project.url;
  card.dataset.id = project.id;
  card.dataset.theme = project.theme;
  card.innerHTML = `
    <h2 class="project-card__title">${project.title}</h2>
    <p class="project-card__desc">${project.description}</p>
    <div class="project-card__tags">
      ${project.tags.map((tag) => `<span class="project-card__tag">${tag}</span>`).join('')}
    </div>
  `;
  return card;
}

export function layoutProjectCards(listEl, projects) {
  const cards = projects.map(createProjectCard);
  const columnCount = getColumnCount(listEl);

  listEl.replaceChildren();
  listEl.dataset.columns = String(columnCount);

  const columns = Array.from({ length: columnCount }, () => {
    const column = document.createElement('li');
    column.className = 'projects-column';
    listEl.appendChild(column);
    return { el: column, height: 0 };
  });

  for (const card of cards) {
    const target = columns.reduce((shortest, column) =>
      column.height < shortest.height ? column : shortest,
    );

    target.el.appendChild(card);
    target.height = target.el.offsetHeight;
  }
}

export function initProjectCards(listEl, projects, { onHover }) {
  const layout = () => layoutProjectCards(listEl, projects);

  if (document.fonts?.ready) {
    document.fonts.ready.then(layout);
  } else {
    layout();
  }

  listEl.addEventListener('mouseover', (event) => {
    const card = event.target.closest('.project-card');
    if (!card || !listEl.contains(card)) return;
    if (event.relatedTarget instanceof Node && card.contains(event.relatedTarget)) return;
    onHover?.(card.dataset.id);
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(layout, 150);
  });
}
