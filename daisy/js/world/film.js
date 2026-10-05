// The lens: 35mm grain (one noise tile jumping around at 24 fps), vignette, lens dirt and 2.39:1 letterbox bars.
// It sits above everything (canvas, CRT desktop, overlay) so the whole frame shares one film stock.
import { gsap } from 'gsap';

function noiseFrame(n) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const img = g.createImageData(n, n);
  for (let k = 0; k < img.data.length; k += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
    img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}

// Smudges and a couple of hairs on the lens. Invisible in the dark; they light up in glare (lightning, the train, the lamp).
function dirtFrame(w = 1024, h = 640) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let k = 0; k < 46; k++) {
    const x = Math.random() * w, y = Math.random() * h, r = 8 + Math.random() * 70;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${0.05 + Math.random() * 0.12})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    let x = Math.random() * w, y = Math.random() * h;
    g.moveTo(x, y);
    for (let s = 0; s < 6; s++) g.quadraticCurveTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60, (x += (Math.random() - 0.5) * 50), (y += (Math.random() - 0.5) * 50));
    g.stroke();
  }
  return c.toDataURL();
}

export function createFilm(el) {
  el.innerHTML = '<div class="film-grain"></div><div class="film-vignette"></div><div class="film-dirt"></div><div class="film-bar top"></div><div class="film-bar bottom"></div>';
  const grain = el.querySelector('.film-grain');
  const bars = el.querySelectorAll('.film-bar');
  const dirt = el.querySelector('.film-dirt');
  dirt.style.backgroundImage = `url(${dirtFrame()})`;
  grain.style.backgroundImage = `url(${noiseFrame(256)})`; // one tile, jumped around by a CSS transform (film.css): no repaints
  return {
    letterbox(on, { duration = 1.2 } = {}) {
      return gsap.to(bars, { scaleY: on ? 1 : 0, duration, ease: 'power2.inOut' }).then(() => {});
    },
    setGrain(v) { grain.style.opacity = String(v); },
    setDirt(v) { dirt.style.opacity = String(v); },
    setDrain(v) { document.documentElement.style.setProperty('--film-drain', String(v)); },
    dispose() { el.innerHTML = ''; },
  };
}
