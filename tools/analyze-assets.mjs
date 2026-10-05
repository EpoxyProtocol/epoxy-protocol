// Reads every byte of every file in brand/ and reference/, reports container
// metadata, alpha histogram, dominant pixels, and a k-means palette snapped to
// real pixel coordinates. Writes tools/out/asset-report.json.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CT = { 0: 'grayscale', 2: 'truecolor', 3: 'indexed', 4: 'grayscale+alpha', 6: 'truecolor+alpha' };

function pngMeta(buf) {
  const sig = buf.subarray(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') return null;
  const chunks = [];
  let o = 8, ihdr = null;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('latin1', o + 4, o + 8);
    if (type === 'IHDR') ihdr = { width: buf.readUInt32BE(o + 8), height: buf.readUInt32BE(o + 12), bitDepth: buf[o + 16], colourType: buf[o + 17], colourTypeName: CT[buf[o + 17]], interlace: buf[o + 20] };
    chunks.push(type + ':' + len);
    o += 12 + len;
  }
  return { ihdr, chunks: chunks.filter((c, i) => !c.startsWith('IDAT') || i === chunks.findIndex(x => x.startsWith('IDAT'))) };
}
function jpegMeta(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let o = 2;
  while (o < buf.length) {
    if (buf[o] !== 0xff) { o++; continue; }
    const m = buf[o + 1], len = buf.readUInt16BE(o + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { sof: '0x' + m.toString(16), precision: buf[o + 4], height: buf.readUInt16BE(o + 5), width: buf.readUInt16BE(o + 7), components: buf[o + 9] };
    o += 2 + len;
  }
  return null;
}

function kmeans(px, k, iters = 24) {
  // deterministic seeding: evenly spaced by luma rank
  const sorted = px.map((p, i) => [p[0] * .299 + p[1] * .587 + p[2] * .114, i]).sort((a, b) => a[0] - b[0]);
  let cs = Array.from({ length: k }, (_, j) => px[sorted[Math.floor((j + .5) * sorted.length / k)][1]].slice(0, 3));
  let asg = new Uint8Array(px.length);
  for (let it = 0; it < iters; it++) {
    const sum = cs.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < px.length; i++) {
      let b = 0, bd = 1e12;
      for (let j = 0; j < k; j++) { const d = (px[i][0] - cs[j][0]) ** 2 + (px[i][1] - cs[j][1]) ** 2 + (px[i][2] - cs[j][2]) ** 2; if (d < bd) { bd = d; b = j; } }
      asg[i] = b; const s = sum[b]; s[0] += px[i][0]; s[1] += px[i][1]; s[2] += px[i][2]; s[3]++;
    }
    cs = cs.map((c, j) => sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : c);
  }
  const counts = new Array(k).fill(0); asg.forEach(a => counts[a]++);
  return { cs, counts, asg };
}
const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

const report = {};
for (const dir of ['brand', 'reference']) {
  for (const f of readdirSync(join(root, dir)).sort()) {
    const path = join(root, dir, f), buf = readFileSync(path);
    const rec = { bytes: buf.length, sha1: createHash('sha1').update(buf).digest('hex').slice(0, 12) };
    rec.png = pngMeta(buf); rec.jpeg = jpegMeta(buf);
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, N = W * H;
    rec.decoded = { width: W, height: H };
    const hist = new Array(8).fill(0); // alpha buckets of 32
    let a0 = 0, a0black = 0, a255 = 0, partial = 0, pureBlackOpaque = 0;
    const quant = new Map();
    const fg = [], fgXY = [];
    for (let i = 0; i < N; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
      hist[a >> 5]++;
      if (a === 0) { a0++; if (!r && !g && !b) a0black++; } else if (a === 255) a255++; else partial++;
      if (a === 255 && !r && !g && !b) pureBlackOpaque++;
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      quant.set(key, (quant.get(key) || 0) + 1);
      const luma = r * .299 + g * .587 + b * .114;
      if (a > 0 && luma > 40 && i % 3 === 0) { fg.push([r, g, b]); fgXY.push(i); }
    }
    rec.alpha = { histogram32: hist, fullyTransparent: a0, transparentPureBlack: a0black, partial, opaque: a255, opaquePureBlack: pureBlackOpaque, opaquePureBlackPct: +(pureBlackOpaque / N * 100).toFixed(2) };
    rec.premultiplyRequired = a0black > 0 && partial > 0;
    rec.dominant = [...quant.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, c]) => ({ hex: hex(((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4), pct: +(c / N * 100).toFixed(2) }));
    if (fg.length > 500) {
      const { cs, counts } = kmeans(fg, 6);
      rec.palette = cs.map((c, j) => {
        // snap to the nearest REAL pixel among the sampled foreground
        let best = 0, bd = 1e12;
        for (let i = 0; i < fg.length; i++) { const d = (fg[i][0] - c[0]) ** 2 + (fg[i][1] - c[1]) ** 2 + (fg[i][2] - c[2]) ** 2; if (d < bd) { bd = d; best = i; } }
        const idx = fgXY[best], p = fg[best];
        return { centroid: hex(...c), snapped: hex(...p), x: idx % W, y: Math.floor(idx / W), share: +(counts[j] / fg.length * 100).toFixed(1) };
      }).sort((a, b) => b.share - a.share);
    }
    report[dir + '/' + f] = rec;
  }
}
mkdirSync(join(root, 'tools/out'), { recursive: true });
writeFileSync(join(root, 'tools/out/asset-report.json'), JSON.stringify(report, null, 2));
for (const [k, v] of Object.entries(report)) {
  console.log('\n' + k, v.bytes + 'B', v.png ? JSON.stringify(v.png.ihdr) : JSON.stringify(v.jpeg));
  console.log('  alpha', JSON.stringify(v.alpha), 'premultiply:', v.premultiplyRequired);
  console.log('  dominant', v.dominant.map(d => d.hex + ' ' + d.pct + '%').join(', '));
  if (v.palette) console.log('  palette', v.palette.map(p => `${p.snapped}@(${p.x},${p.y}) ${p.share}%`).join(' | '));
}
