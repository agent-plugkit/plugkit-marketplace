// Seed libraries for the musepool tests: the bundled snapshot relabelled as another release,
// optionally with extra seeds, and the 1.3.0-shaped library built from release-1.3.0-additions.json.
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = dirname(fileURLToPath(import.meta.url));
export const bundledSeeds = join(fixtures, '../../../plugins/musekit/skills/musepool/seeds');

// Copy the bundled snapshot to <dir>/muspro-seeds-<version>, relabel it as `version` and add
// `additions` (index entries with their Chinese title and summary under `zh`). Seed bodies of the
// additions are generated from the gist.
export function buildLibrary(dir, version, additions = []) {
  const library = join(dir, `muspro-seeds-${version}`);
  cpSync(bundledSeeds, library, { recursive: true });
  const index = JSON.parse(readFileSync(join(library, 'index.json'), 'utf8'));
  const scenarios = JSON.parse(readFileSync(join(library, 'scenarios.json'), 'utf8'));
  for (const { zh, ...entry } of additions) {
    index.seeds.push(entry);
    scenarios.scenarios.find((group) => group.id === entry.scenario).seeds
      .push({ id: entry.id, file: entry.file, ...zh });
    writeFileSync(join(library, ...entry.file.split('/')),
      `---\nid: ${entry.id}\nscenario: ${entry.scenario}\ncategory: ${entry.category}\n---\n\n${entry.gist}\n`);
  }
  index.version = version;
  scenarios.version = version;
  writeFileSync(join(library, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  writeFileSync(join(library, 'scenarios.json'), `${JSON.stringify(scenarios, null, 2)}\n`);
  return library;
}

// The bundled snapshot plus the three seeds Muspro Seeds 1.3.0 added.
export function release130(dir) {
  const { version, seeds } = JSON.parse(readFileSync(join(fixtures, 'release-1.3.0-additions.json'), 'utf8'));
  return { library: buildLibrary(dir, version, seeds), version };
}
