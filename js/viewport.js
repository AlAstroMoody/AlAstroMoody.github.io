// Размер layout viewport — совпадает с системой координат getBoundingClientRect().
// window.innerWidth включает полосу прокрутки и ломает привязку canvas к DOM.
export function getViewportSize() {
  return {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  };
}
