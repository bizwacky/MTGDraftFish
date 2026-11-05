/** Regenerate public/halftone/tokens.css from tokens.json with the bundle's own tokensToCss, so the two never drift. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const dir = path.join(process.cwd(), 'public', 'halftone');
  const src = await readFile(path.join(dir, 'bundle.js'), 'utf8');
  const tokens = JSON.parse(await readFile(path.join(dir, 'tokens.json'), 'utf8'));
  // The bundle is a classic script that expects a window; give it a minimal one.
  const win: any = { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  const doc: any = { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), head: { appendChild() {} }, documentElement: { getAttribute: () => null, setAttribute() {}, style: {} }, querySelector: () => null, getElementById: () => null, addEventListener() {} };
  win.document = doc;
  new Function('window', 'document', 'navigator', src)(win, doc, { userAgent: 'node' });
  const css: string = win.Halftone.tokensToCss(tokens, { fontBase: './fonts/', autoDark: true });
  await writeFile(path.join(dir, 'tokens.css'), `/* Halftone — generated from tokens.json by scripts/build-halftone-css.ts; do not edit by hand */\n` + css);
  console.log(`wrote public/halftone/tokens.css (${css.length} bytes)`);
}
main();
