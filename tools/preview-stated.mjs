// Writes a throwaway copy of dist/ into tools/out/preview-stated with a synthetic contract address,
// so the stated branch can be looked at in a browser. Never touches dist/.
import { cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildSite, loadRegister, root, tokenValue } from './build.mjs';
const out = join(root, 'tools/out/preview-stated');
rmSync(out, { recursive: true, force: true });
cpSync(join(root, 'dist'), out, { recursive: true });
const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
const css = html.match(/assets\/app\.[0-9a-f]+\.css/)[0], js = html.match(/assets\/app\.[0-9a-f]+\.js/)[0];
const reg = loadRegister();
reg.contract = { ...reg.contract, state: 'stated', value: '0x' + 'aB'.repeat(20) };
reg.github = { ...reg.github, state: 'stated', value: 'https://github.com/synthetic-org' };
const site = buildSite(reg, { css, js, themeColor: tokenValue(readFileSync(join(root, 'src/tokens.css'), 'utf8'), 'px-void') });
writeFileSync(join(out, 'index.html'), site.html);
writeFileSync(join(out, '_headers'), site.headers);
console.log('preview written');
