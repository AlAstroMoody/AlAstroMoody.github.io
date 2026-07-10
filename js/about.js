import { playFlash } from './intro.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initAbout(orbitSystemEl) {
  const button = document.getElementById('about-button');
  const panel = document.getElementById('about-panel');
  const closeButton = panel.querySelector('.about-panel__close');

  function isOpen() {
    return document.body.classList.contains('is-about');
  }

  function open() {
    if (isOpen()) return;

    if (!reducedMotion) {
      playFlash(orbitSystemEl);
    }

    document.body.classList.add('is-about');
    button.setAttribute('aria-expanded', 'true');
    closeButton.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen()) return;

    document.body.classList.remove('is-about');
    button.setAttribute('aria-expanded', 'false');
    button.focus({ preventScroll: true });
  }

  button.addEventListener('click', open);
  closeButton.addEventListener('click', close);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  document.addEventListener('click', (event) => {
    if (!isOpen()) return;
    if (panel.contains(event.target) || button.contains(event.target)) return;
    close();
  });
}
