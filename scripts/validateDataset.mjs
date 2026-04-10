// Validates the generated dataset against schemas/prices.schema.json.
//
// Runs as the last step of `npm run generate-data` and as a standalone
// `npm run validate` check. A schema mismatch exits non-zero and fails the
// CI build, which means the live site stays on the last known good dataset.
// See ADR-0003 for the stability pledge this enforces.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const root = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(root, '..', 'schemas', 'prices.schema.json');
const dataPath = path.resolve(root, '..', 'public', 'api', 'v1', 'prices.json');

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const ok = validate(data);
if (!ok) {
  console.error('❌ prices.json does not match schemas/prices.schema.json\n');
  for (const err of validate.errors ?? []) {
    console.error(`  ${err.instancePath || '/'}  ${err.message}`);
    if (err.params && Object.keys(err.params).length) {
      console.error(`      ${JSON.stringify(err.params)}`);
    }
  }
  console.error(
    '\nThe pipeline output drifted from the declared schema. Either:\n' +
      '  (a) fix the generator so the output matches the schema, or\n' +
      '  (b) bump the schema and document the change in docs/architecture/adr/.\n' +
      'Do NOT loosen the schema silently — consumers depend on it.'
  );
  process.exit(1);
}

console.log(
  `✓ prices.json matches schema (${data.regions.length} regions, ` +
    `last updated ${data.lastUpdated})`
);
