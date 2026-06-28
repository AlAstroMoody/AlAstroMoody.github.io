const WEATHER_BASE = 'https://alastromoody.github.io/weather';

function loadWeatherFX() {
  return new Promise((resolve, reject) => {
    if (window.WeatherFX) {
      resolve(window.WeatherFX);
      return;
    }

    const script = document.createElement('script');
    script.src = `${WEATHER_BASE}/weather.js`;

    const timeout = setTimeout(() => {
      reject(new Error('WeatherFX load timeout'));
    }, 10000);

    script.onload = () => {
      clearTimeout(timeout);
      if (window.WeatherFX) {
        resolve(window.WeatherFX);
      } else {
        reject(new Error('WeatherFX not found'));
      }
    };

    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load WeatherFX'));
    };

    document.head.appendChild(script);
  });
}

let weatherFx = null;
let canvas = null;

function handleResize() {
  if (weatherFx && canvas && weatherFx.resize) {
    const rect = canvas.getBoundingClientRect();
    weatherFx.resize(rect.width, rect.height);
  }
}

export function stopWeatherFX() {
  if (weatherFx) {
    weatherFx.stop();
    weatherFx = null;
  }
  window.removeEventListener('resize', handleResize);
  canvas = null;
}

export async function startWeatherFX(targetCanvas) {
  stopWeatherFX();

  if (!targetCanvas) return;

  canvas = targetCanvas;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const WeatherFXClass = await loadWeatherFX();

  weatherFx = new WeatherFXClass({
    canvas,
    background: `${WEATHER_BASE}/rain.webp`,
  });

  window.addEventListener('resize', handleResize);
  await weatherFx.start();
}
