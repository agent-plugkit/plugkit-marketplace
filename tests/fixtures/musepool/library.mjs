// Seed libraries for the musepool tests: the bundled snapshot relabelled as another release.
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = dirname(fileURLToPath(import.meta.url));
export const bundledSeeds = join(fixtures, '../../../plugins/musekit/skills/musepool/seeds');

// Copy the bundled snapshot to <dir>/muspro-seeds-<version> and relabel it as `version`.
export function buildLibrary(dir, version) {
  const library = join(dir, `muspro-seeds-${version}`);
  cpSync(bundledSeeds, library, { recursive: true });
  for (const file of ['index.json', 'scenarios.json']) {
    const data = JSON.parse(readFileSync(join(library, file), 'utf8'));
    data.version = version;
    writeFileSync(join(library, file), `${JSON.stringify(data, null, 2)}\n`);
  }
  return library;
}
