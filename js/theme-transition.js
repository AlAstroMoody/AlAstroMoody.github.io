// Смена темы без анимации — мгновенно, без блокировки взаимодействий
export function withThemeTransition(update) {
  update();
}
