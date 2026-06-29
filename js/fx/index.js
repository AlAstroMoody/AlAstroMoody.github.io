import { startWeatherFX, stopWeatherFX } from './weather.js';
import { startGsFX, stopGsFX } from './gs.js';
import { startRadioFX, stopRadioFX } from './radio.js';
import { startBudgetFX, stopBudgetFX } from './budget.js';

const FX_HANDLERS = {
  weather: { start: startWeatherFX, stop: stopWeatherFX },
  gs: { start: startGsFX, stop: stopGsFX },
  radio: { start: startRadioFX, stop: stopRadioFX },
  budget: { start: startBudgetFX, stop: stopBudgetFX },
};

export const FX_PROJECTS = new Set(Object.keys(FX_HANDLERS));

let fxToken = 0;
let activeFx = null;

function resetFxCanvas() {
  const current = document.getElementById('bg-fx');
  if (!current || !current.closest('.backdrop')) return null;

  const next = document.createElement('canvas');
  next.id = 'bg-fx';
  next.setAttribute('aria-hidden', 'true');
  current.replaceWith(next);
  return next;
}

function stopActiveFx() {
  if (!activeFx) return;

  FX_HANDLERS[activeFx]?.stop();
  activeFx = null;
  document.body.classList.remove('fx-ready');
}

export async function setProjectFx(projectId) {
  const token = ++fxToken;
  stopActiveFx();

  if (token !== fxToken) return;

  const handler = FX_HANDLERS[projectId];
  if (!handler) return;

  const canvas = resetFxCanvas();
  if (!canvas) return;

  try {
    await handler.start(canvas);

    if (token !== fxToken) {
      handler.stop();
      return;
    }

    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    if (token !== fxToken) {
      handler.stop();
      return;
    }

    document.body.classList.add('fx-ready');
    activeFx = projectId;
  } catch {
    handler.stop();
    activeFx = null;
    document.body.classList.remove('fx-ready');
  }
}

export function clearProjectFx() {
  fxToken++;
  stopActiveFx();
}
