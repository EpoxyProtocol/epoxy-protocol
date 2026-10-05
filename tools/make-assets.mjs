// Generates logo sizes (premultiplied area-average resize), favicon SVG traced
// from the real pixel grid, touch icon, share image and hero backdrop.
// Source of truth: brand/ and reference/ files. Output: src/assets/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src/assets');
mkdirSync(out, { recursive: true });

// The transparent logo is RGBA with ~3.47M pure-black alpha=0 pixels and ~13k
// partial-alpha edge pixels, so every resize happens in premultiplied space.
const src = join(root, 'brand', 'LOGO EPOXY PNG...png');
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;

let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
const bw = x1 - x0 + 1, bh = y1 - y0 + 1, side = Math.max(bw, bh);
const pad = Math.round(side * 0.06), S = side + pad * 2;
const ox = x0 - Math.round((S - bw) / 2), oy = y0 - Math.round((S - bh) / 2);

// premultiplied float square crop (S x S x 4)
const pm = new Float32Array(S * S * 4);
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const sx = x + ox, sy = y + oy;
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
  const i = (sy * W + sx) * 4, a = data[i + 3] / 255, o = (y * S + x) * 4;
  pm[o] = data[i] * a; pm[o + 1] = data[i + 1] * a; pm[o + 2] = data[i + 2] * a; pm[o + 3] = data[i + 3];
}
function areaResize(srcBuf, sw, sh, dw, dh) {
  const dst = new Float32Array(dw * dh * 4), fx = sw / dw, fy = sh / dh;
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const xa = x * fx, xb = xa + fx, ya = y * fy, yb = ya + fy;
    let r = 0, g = 0, b = 0, a = 0, wsum = 0;
    for (let sy = Math.floor(ya); sy < Math.ceil(yb); sy++) {
      const wy = Math.min(sy + 1, yb) - Math.max(sy, ya);
      for (let sx = Math.floor(xa); sx < Math.ceil(xb); sx++) {
        const w = wy * (Math.min(sx + 1, xb) - Math.max(sx, xa)), i = (sy * sw + sx) * 4;
        r += srcBuf[i] * w; g += srcBuf[i + 1] * w; b += srcBuf[i + 2] * w; a += srcBuf[i + 3] * w; wsum += w;
      }
    }
    const o = (y * dw + x) * 4; dst[o] = r / wsum; dst[o + 1] = g / wsum; dst[o + 2] = b / wsum; dst[o + 3] = a / wsum;
  }
  return dst;
}
function unpremultiply(f, n) {
  const u = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const a = f[i * 4 + 3] / 255, a8 = Math.round(f[i * 4 + 3]);
    u[i * 4 + 3] = a8;
    for (let c = 0; c < 3; c++) u[i * 4 + c] = a8 > 0 ? Math.min(255, Math.round(f[i * 4 + c] / a)) : 0;
  }
  return u;
}
const report = { crop: { x0, y0, x1, y1, side: S }, outputs: [] };
for (const n of [512, 256, 128, 64]) {
  const f = areaResize(pm, S, S, n, n);
  await sharp(unpremultiply(f, n * n), { raw: { width: n, height: n, channels: 4 } }).png({ compressionLevel: 9 }).toFile(join(out, `logo-${n}.png`));
  report.outputs.push(`logo-${n}.png`);
}

// favicon: 32x32 grid, each cell holds a real premultiplied-average pixel of
// the logo, snapped to the nearest of the six palette pixels measured earlier.
const PALETTE = ['#fdec97', '#fdd05e', '#fdb32e', '#f8810d', '#e75204', '#c23803'];
const pal = PALETTE.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
const G = 30, f32 = areaResize(pm, S, S, G, G), cells = unpremultiply(f32, G * G);
const grid = [];
for (let y = 0; y < G; y++) {
  const row = [];
  for (let x = 0; x < G; x++) {
    const i = (y * G + x) * 4;
    if (cells[i + 3] < 128) { row.push(-1); continue; }
    let b = 0, bd = 1e9;
    pal.forEach((p, k) => { const d = (p[0] - cells[i]) ** 2 + (p[1] - cells[i + 1]) ** 2 + (p[2] - cells[i + 2]) ** 2; if (d < bd) { bd = d; b = k; } });
    row.push(b);
  }
  grid.push(row);
}
const paths = PALETTE.map(() => '');
for (let y = 0; y < G; y++) {
  let x = 0;
  while (x < G) {
    const k = grid[y][x];
    if (k < 0) { x++; continue; }
    let e = x; while (e < G && grid[y][e] === k) e++;
    paths[k] += `M${x + 1} ${y + 1}h${e - x}v1h-${e - x}z`;
    x = e;
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges">` +
  PALETTE.map((h, k) => paths[k] ? `<path fill="${h}" d="${paths[k]}"/>` : '').join('') + `</svg>`;
if (svg.includes('--')) throw new Error('favicon contains double hyphen');
writeFileSync(join(out, 'favicon.svg'), svg);
report.outputs.push('favicon.svg (' + svg.length + 'B)');

// touch icon on the sampled slide brown (#2c1505, real pixel of reference/EPOXY 1 at 800,150)
const t = areaResize(pm, S, S, 140, 140), tu = unpremultiply(t, 140 * 140);
await sharp({ create: { width: 180, height: 180, channels: 3, background: '#2c1505' } })
  .composite([{ input: await sharp(tu, { raw: { width: 140, height: 140, channels: 4 } }).png().toBuffer(), left: 20, top: 20 }])
  .png().toFile(join(out, 'apple-touch-icon.png'));

// share image + hero backdrop from the cover banner
const cover = join(root, 'reference', 'SAMPUL EPOXY JPG.jpg.jpeg');
await sharp(cover).resize(1200, 400).jpeg({ quality: 84, mozjpeg: true }).toFile(join(out, 'og.jpg'));
await sharp(cover).webp({ quality: 72 }).toFile(join(out, 'hero-backdrop.webp'));
writeFileSync(join(root, 'tools/out/assets-made.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
