// Ships a tiny CJS shim alongside the ESM build so the package works from both
// `import` and `require()` without bringing in a bundler.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const esmPath = resolve(here, 'dist/index.js');
const cjsPath = resolve(here, 'dist/index.cjs');
const esm = readFileSync(esmPath, 'utf8');
// Minimal transform: export * → module.exports = { ... } via re-require.
writeFileSync(
  cjsPath,
  `'use strict';\nmodule.exports = require('./index.js');\n`
);
void esm;
