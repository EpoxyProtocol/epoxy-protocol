// Build: src/ -> dist/ (the folder that gets deployed). Exports buildSite() so the
// gates can render with synthetic registers without touching disk.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build as esbuild, transform } from 'esbuild';
import { renderPage, BOOT } from '../src/page.js';
import { buildCsp, buildHeaders } from '../src/csp.js';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const loadRegister = () => JSON.parse(readFileSync(join(root, 'src/register.json'), 'utf8'));
const sha = (s, alg = 'sha256', enc = 'base64') => createHash(alg).update(s).digest(enc);

// The page only ever sees the public face of the register: no sources, no dates.
export function publicRegister(reg) {
  const out = {};
  for (const [k, r] of Object.entries(reg)) out[k] = { state: r.state, value: r.value };
  return out;
}

export function tokenValue(css, name) {
  const m = css.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{3,8})'));
  return m ? m[1] : '';
}

// Pure: register in, html + headers out.
export function buildSite(reg, { css = 'assets/app.css', js = 'assets/app.js', themeColor = '' } = {}) {
  const pub = publicRegister(reg);
  const bootHash = sha(BOOT);
  const html = renderPage(pub, { css, js, themeColor, cspMeta: buildCsp(pub, { bootHash, meta: true }) });
  const csp = buildCsp(pub, { bootHash });
  return { html, csp, headers: buildHeaders(pub, csp), bootHash };
}

export async function main() {
  const reg = loadRegister();
  const dist = join(root, 'dist');
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(join(dist, 'assets/fonts'), { recursive: true });

  const tokens = readFileSync(join(root, 'src/tokens.css'), 'utf8');
  const styles = readFileSync(join(root, 'src/styles.css'), 'utf8');
  const cssOut = await transform(tokens + '\n' + styles, { loader: 'css', minify: true });
  const cssName = `app.${sha(cssOut.code, 'sha1', 'hex').slice(0, 10)}.css`;
  writeFileSync(join(dist, 'assets', cssName), cssOut.code);

  const jsRes = await esbuild({ entryPoints: [join(root, 'src/js/app.js')], bundle: true, minify: true, format: 'esm', target: 'es2020', write: false, legalComments: 'none' });
  const jsCode = jsRes.outputFiles[0].text;
  const jsName = `app.${sha(jsCode, 'sha1', 'hex').slice(0, 10)}.js`;
  writeFileSync(join(dist, 'assets', jsName), jsCode);

  const fonts = join(root, 'node_modules/@fontsource-variable');
  cpSync(join(fonts, 'inter/files/inter-latin-wght-normal.woff2'), join(dist, 'assets/fonts/inter.woff2'));
  cpSync(join(fonts, 'jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2'), join(dist, 'assets/fonts/jetbrains-mono.woff2'));
  for (const f of readdirSync(join(root, 'src/assets'))) cpSync(join(root, 'src/assets', f), join(dist, 'assets', f));
  cpSync(join(root, 'src/assets/favicon.svg'), join(dist, 'favicon.svg'));

  const { html, headers } = buildSite(reg, { css: 'assets/' + cssName, js: 'assets/' + jsName, themeColor: tokenValue(tokens, 'px-void') });
  writeFileSync(join(dist, 'index.html'), html);
  writeFileSync(join(dist, '_headers'), headers);
  writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  console.log(`dist ready: index.html, assets/${cssName}, assets/${jsName}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
