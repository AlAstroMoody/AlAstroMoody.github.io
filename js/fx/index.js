import { startWeatherFX, stopWeatherFX } from './weather.js';

let fxToken = 0;
let activeFx = null;

export async function setProjectFx(projectId) {
  if (projectId === 'weather' && activeFx === 'weather') return;

  const token = ++fxToken;

  if (activeFx === 'weather') {
    stopWeatherFX();
    activeFx = null;
  }

  document.body.classList.remove('fx-weather-ready');

  if (token !== fxToken) return;

  if (projectId !== 'weather') return;

  const canvas = document.getElementById('bg-fx');
  try {
    await startWeatherFX(canvas);
    if (token !== fxToken) {
      stopWeatherFX();
      return;
    }

    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    if (token !== fxToken) {
      stopWeatherFX();
      return;
    }

    document.body.classList.add('fx-weather-ready');
    activeFx = 'weather';
  } catch {
    stopWeatherFX();
    activeFx = null;
    document.body.classList.remove('fx-weather-ready');
  }
}

export function clearProjectFx() {
  fxToken++;
  if (activeFx === 'weather') {
    stopWeatherFX();
  }
  activeFx = null;
  document.body.classList.remove('fx-weather-ready');
}
