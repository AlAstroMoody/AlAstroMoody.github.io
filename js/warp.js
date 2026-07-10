const DURATION = 700;
const STAR_COUNT = 170;

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

let warping = false;

// При возврате «назад» браузер восстанавливает страницу из bfcache в том виде,
// в котором она ушла — вместе с канвасом прыжка. Убираем его и снимаем блокировку.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  warping = false;
  document.querySelectorAll('.warp-canvas').forEach((el) => el.remove());
});

// Гиперпрыжок: звёзды вытягиваются в линии от центра экрана наружу
export function playWarp(accentColor = '#6366f1') {
  if (warping) return Promise.resolve();

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return Promise.resolve();
  }

  warping = true;

  const canvas = document.createElement('canvas');
  canvas.className = 'warp-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const width = canvas.width = window.innerWidth;
  const height = canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(cx, cy);
  const rgb = hexToRgb(accentColor.startsWith('#') ? accentColor : '#6366f1');

  const stars = Array.from({ length: STAR_COUNT }, () => ({
    angle: Math.random() * Math.PI * 2,
    dist: 20 + Math.random() * maxR,
    speed: 0.5 + Math.random() * 1.3,
  }));

  return new Promise((resolve) => {
    const start = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - start) / DURATION);
      const ease = t * t;

      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = `rgba(8, 8, 15, ${0.6 * ease})`;
      ctx.fillRect(0, 0, width, height);

      ctx.lineCap = 'round';

      for (const s of stars) {
        const cos = Math.cos(s.angle);
        const sin = Math.sin(s.angle);
        const d0 = s.dist * (1 + ease * 2.5 * s.speed);
        const d1 = d0 + 10 + 180 * ease * s.speed;
        const alpha = Math.min(1, ease * 3) * 0.85;

        ctx.beginPath();
        ctx.moveTo(cx + cos * d0, cy + sin * d0);
        ctx.lineTo(cx + cos * d1, cy + sin * d1);
        ctx.strokeStyle = `rgba(${rgb}, ${alpha * 0.45})`;
        ctx.lineWidth = 2.5 + ease * 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx + cos * d0, cy + sin * d0);
        ctx.lineTo(cx + cos * d1, cy + sin * d1);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 1 + ease;
        ctx.stroke();
      }

      // Финальная вспышка перед переходом
      if (t > 0.75) {
        const flash = (t - 0.75) / 0.25;
        ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.55})`;
        ctx.fillRect(0, 0, width, height);
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        // Канвас не убираем: страница сейчас сменится, а тёмный кадр скрывает мигание
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}
