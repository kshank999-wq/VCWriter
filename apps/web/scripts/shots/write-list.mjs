/**
 * Write docs/screenshots.md from the shot list, so the list a person reads
 * and the list the capture runs are the same list.
 *
 *   node apps/web/scripts/shots/write-list.mjs
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SHOTS } from './shot-list.mjs';

const root = resolve(import.meta.dirname, '..', '..', '..', '..');
const PROJECTS = {
  screenplay: 'Night of the Living Dead (screenplay, public domain)',
  series: 'Sherlock Holmes (series, after Conan Doyle)',
  novel: 'Great Expectations (novel, Dickens)',
  instructional: 'Plain and Clear (instructional book)',
  stage_play: 'Hamlet (stage play, Shakespeare)',
  short_story: 'Tales of Mystery (collection, Poe)',
  short_form: 'Harbour Bakery — 30s Spot (short form)',
  document: 'Heron Window Proposal (document)',
};

const rows = SHOTS.map(
  (shot) =>
    `| [\`${shot.id}\`](../apps/web/public/${shot.out}/${shot.id}.jpg) | ${shot.shows} | ${PROJECTS[shot.project] ?? shot.project} | ${shot.uses.join('; ')} |`,
);

const text = `# Screenshots

Every screenshot of VC Writer that the site, the help guides and the release
notes use. **Generated from \`apps/web/scripts/shots/shot-list.mjs\`; do not
edit by hand.** Rewrite it with \`node apps/web/scripts/shots/write-list.mjs\`.

Retake them all with \`pnpm --filter @vcwriter/web shots\`, or retake some by
naming them: \`pnpm --filter @vcwriter/web shots -- sculptor outliner\`. The
capture builds the browser preview, opens each shot's demo project
(\`demo-projects.mjs\`: public-domain classics for the story modules, original writing for the rest),
walks to the screen and saves it at 2880×1800. Retake after any change to a
screen a shot shows. Addendum 35 §7–§8 says how it works.

The phone app's store screenshots are not here. They have to come from a real
device or simulator (\`docs/store-listing.md\` §4).

| Shot | What it shows | Demo project | Used on |
| --- | --- | --- | --- |
${rows.join('\n')}
`;

writeFileSync(resolve(root, 'docs', 'screenshots.md'), text);
console.log(`docs/screenshots.md: ${SHOTS.length} shots`);
