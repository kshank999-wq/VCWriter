/**
 * The sample projects (from Ken, 12 November: *sample projects for each
 * module … available as a sample that you can load … when you have writer's
 * room*).
 *
 * They are the demo projects the screenshots are taken from
 * (shots/demo-projects.mjs), built with the domain's own importers, minus the
 * short-form spot's storyboard frames: a sample is text, for the writer to
 * board. Each is written as a .vcw twice — into the desktop renderer, so the
 * start screen opens one with no connection, and into the site's public
 * folder, so a Writers Room can start from one — with a list beside each.
 *
 *   cd apps/web && node scripts/samples.mjs
 *
 * Run it again after changing the demo projects; the desktop's test fails
 * when its copies and the site's differ.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { demoProjects } from './shots/demo-projects.mjs';

const ORDER = ['screenplay', 'series', 'stage_play', 'short_form', 'novel', 'short_story', 'instructional', 'document'];
const ABOUT = {
  screenplay: 'The opening scenes of the 1968 film, with notes, a story map, setups and an outline.',
  series: 'Three episodes after Arthur Conan Doyle, in Doyle’s own words.',
  stage_play: 'Act One, Scene One of Hamlet, with the rest of the act planned in the outline.',
  short_form: 'A 30-second spot as an audio/visual sheet, ready for your own storyboard frames.',
  novel: 'The first three chapters of Dickens, with an outline of chapters and sections.',
  short_story: 'Three of Poe’s tales as one collection.',
  instructional: 'Two chapters of a writing guide, with sources, citations and an outline.',
  document: 'A short heritage-trust proposal in the word processor.',
};

const projects = demoProjects({ frames: false });
const here = import.meta.dirname;
const places = [resolve(here, '..', 'public', 'samples'), resolve(here, '..', '..', 'desktop', 'src', 'renderer', 'samples')];
const list = ORDER.filter((format) => projects[format]).map((format) => {
  const file = projects[format];
  return { format, file: `${format}.vcw`, title: file.project.title, author: file.project.author ?? '', about: ABOUT[format] ?? '' };
});
for (const dir of places) {
  mkdirSync(dir, { recursive: true });
  for (const one of list) writeFileSync(resolve(dir, one.file), JSON.stringify(projects[one.format]) + '\n');
  writeFileSync(resolve(dir, 'samples.json'), JSON.stringify(list, null, 2) + '\n');
}
console.log(`Wrote ${list.length} samples:`, list.map((one) => one.title).join(', '));
