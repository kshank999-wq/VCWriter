import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { freshCopy, parseProjectFile } from '@vcwriter/domain';

/**
 * The sample projects (addendum 35 §15). One set is written by
 * `node scripts/samples.mjs` into two places — the website's `/samples`, which
 * the Writers Room starts from, and the desktop renderer, which opens them
 * from the Welcome screen — and the two must not drift apart.
 */
const web = join(__dirname, '..', '..', '..', 'public', 'samples');
const desktop = join(__dirname, '..', '..', '..', '..', 'desktop', 'src', 'renderer', 'samples');

const listing = JSON.parse(readFileSync(join(web, 'samples.json'), 'utf8')) as { format: string; file: string; title: string }[];

describe('sample projects', () => {
  it('are the same files on the website and in the desktop program', () => {
    const names = readdirSync(web).sort();
    expect(readdirSync(desktop).sort()).toEqual(names);
    for (const name of names) expect(readFileSync(join(desktop, name), 'utf8'), name).toBe(readFileSync(join(web, name), 'utf8'));
  });

  it('cover every module, each a project file that opens', () => {
    expect(listing.map((one) => one.format).sort()).toEqual(
      ['document', 'instructional', 'novel', 'screenplay', 'series', 'short_form', 'short_story', 'stage_play'],
    );
    for (const one of listing) {
      const file = parseProjectFile(JSON.parse(readFileSync(join(web, one.file), 'utf8')));
      expect(file.project.format, one.file).toBe(one.format);
      expect(file.project.title).toBe(one.title);
    }
  });

  it('copy with new ids, so two openings never share one', () => {
    const raw = JSON.parse(readFileSync(join(web, 'screenplay.vcw'), 'utf8'));
    const ids = (text: string) => new Set(text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? []);
    const before = ids(JSON.stringify(raw));
    const after = ids(JSON.stringify(freshCopy(parseProjectFile(raw))));
    expect(after.size).toBe(before.size);
    for (const id of after) expect(before.has(id)).toBe(false);
  });
});
