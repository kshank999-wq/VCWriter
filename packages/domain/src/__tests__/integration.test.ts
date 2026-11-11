import { describe, expect, it } from 'vitest';
import {
  applyIntegration,
  applyIntegrations,
  beatHash,
  commitBeatVersion,
  contributorsOf,
  nextBeatVersionName,
  passageText,
  segmentText,
  wordDiff,
  type IntegrationOp,
  type ManuscriptSegment,
} from '../index.js';

/** Selection-to-selection integration (addendum 07 §30; workflow spec v1.1 §6.3–§6.4). */

const el = (id: string, text: string, type = 'action') => ({ id, type, text, characterId: null, attributes: {} }) as never;
const seg = (...elements: unknown[]): ManuscriptSegment => ({ elements: elements as never });

const master = seg(el('e1', 'She opens the letter and leaves.'), el('e2', 'The door bangs shut.'));
const ab = seg(el('e1', 'She opens the letter, hesitates, and hides it beneath the floorboard.'), el('e2', 'The door bangs shut.'));
const cd = seg(el('e1', 'Rain on the window.'), el('x9', 'MARA', 'character'), el('x10', 'Not again.', 'dialogue'));

const whole = (id: string, text: string) => ({ startElementId: id, startOffset: 0, endElementId: id, endOffset: text.length });

const op = (over: Partial<IntegrationOp>): IntegrationOp => ({
  id: 'o1',
  kind: 'replace',
  source: {
    submissionId: 's-ab',
    versionId: 'v-ab',
    authorId: 'ab',
    beatId: 'b3',
    anchor: whole('e1', 'She opens the letter, hesitates, and hides it beneath the floorboard.'),
    quote: 'She opens the letter, hesitates, and hides it beneath the floorboard.',
  },
  dest: { beatId: 'b3', anchor: whole('e1', 'She opens the letter and leaves.'), quote: 'She opens the letter and leaves.' },
  actorId: 'sr',
  at: '2026-11-10T00:00:00.000Z',
  ...over,
});

describe('one step', () => {
  it('replaces the master selection with the writer’s, and credits them (the worked example)', () => {
    const out = applyIntegration(master, op({}), ab) as ManuscriptSegment;
    expect(segmentText(out)).toBe('She opens the letter, hesitates, and hides it beneath the floorboard.\nThe door bangs shut.');
    expect(contributorsOf(out)).toEqual(['ab']);
    expect(segmentText(master)).toBe('She opens the letter and leaves.\nThe door bangs shut.');
  });

  it('inserts before and after, and deletes master text with no source', () => {
    const before = applyIntegration(
      master,
      op({ kind: 'insert_before', dest: { beatId: 'b3', anchor: whole('e2', 'The door bangs shut.'), quote: 'The door bangs shut.' } }),
      ab,
    ) as ManuscriptSegment;
    expect(before.elements.map((one) => one.text)).toEqual([
      'She opens the letter and leaves.',
      'She opens the letter, hesitates, and hides it beneath the floorboard.',
      'The door bangs shut.',
    ]);

    const del = applyIntegration(
      master,
      op({ kind: 'delete', source: null, dest: { beatId: 'b3', anchor: { startElementId: 'e1', startOffset: 20, endElementId: 'e1', endOffset: 31 }, quote: ' and leaves' } }),
      null,
    ) as ManuscriptSegment;
    expect(del.elements[0]!.text).toBe('She opens the letter.');
  });

  it('brings in several elements, keeping their types', () => {
    const out = applyIntegration(
      master,
      op({
        kind: 'insert_after',
        source: { submissionId: 's-cd', versionId: 'v-cd', authorId: 'cd', beatId: 'b3', anchor: { startElementId: 'x9', startOffset: 0, endElementId: 'x10', endOffset: 10 }, quote: 'MARA\nNot again.' },
        dest: { beatId: 'b3', anchor: whole('e2', 'The door bangs shut.'), quote: 'The door bangs shut.' },
      }),
      cd,
    ) as ManuscriptSegment;
    expect(out.elements.map((one) => one.type)).toEqual(['action', 'action', 'character', 'dialogue']);
    expect(out.elements[2]!.text).toBe('MARA');
  });

  it('never guesses: words that moved are refused', () => {
    expect(applyIntegration(master, op({ dest: { beatId: 'b3', anchor: whole('e1', 'She opens the letter and leaves.'), quote: 'Something else' } }), ab)).toEqual({ reason: 'destination_moved' });
    expect(applyIntegration(master, op({}), cd)).toEqual({ reason: 'source_moved' });
    expect(applyIntegration(master, op({ kind: 'delete' }), ab)).toEqual({ reason: 'delete_takes_no_source' });
    expect(applyIntegration(master, op({ dest: { ...op({}).dest, beatId: 'b4' } }), ab)).toEqual({ reason: 'other_beat' });
  });
});

describe('several steps, then a new beat version', () => {
  it('combines two writers in one beat, each credited', () => {
    const first = op({});
    const afterFirst = applyIntegration(master, first, ab) as ManuscriptSegment;
    const second = op({
      id: 'o2',
      kind: 'insert_after',
      source: { submissionId: 's-cd', versionId: 'v-cd', authorId: 'cd', beatId: 'b3', anchor: whole('e1', 'Rain on the window.'), quote: 'Rain on the window.' },
      dest: { beatId: 'b3', anchor: whole('e2', 'The door bangs shut.'), quote: 'The door bangs shut.' },
    });
    const out = applyIntegrations(master, [first, second], new Map([['v-ab', ab], ['v-cd', cd]])) as ManuscriptSegment;
    expect(segmentText(out)).toBe(`${segmentText(afterFirst).split('\n')[0]}\nThe door bangs shut.\nRain on the window.`);
    expect(contributorsOf(out)).toEqual(['ab', 'cd']);
  });

  it('reports which step failed', () => {
    const out = applyIntegrations(master, [op({}), op({ id: 'o2' })], new Map([['v-ab', ab]]));
    expect(out).toMatchObject({ reason: 'destination_moved', step: 1 });
  });

  it('commits as the next version and keeps the one before whole', () => {
    const file = { beats: [{ id: 'b3', revisionName: 'Draft 4', revisions: [], manuscript: master }] } as never;
    const done = commitBeatVersion(file, 'b3', applyIntegration(master, op({}), ab) as ManuscriptSegment);
    if ('reason' in done) throw new Error('refused');
    const beat = (done.file as { beats: { revisionName: string; revisions: { name: string; manuscript: ManuscriptSegment }[] }[] }).beats[0]!;
    expect(done).toMatchObject({ from: 'Draft 4', to: 'Draft 5' });
    expect(beat.revisionName).toBe('Draft 5');
    expect(beat.revisions[0]!.name).toBe('Draft 4');
    expect(segmentText(beat.revisions[0]!.manuscript)).toBe(segmentText(master));
  });
});

describe('helpers', () => {
  it('names versions on from the last', () => {
    expect(nextBeatVersionName({ revisionName: 'Draft 1', revisions: [] })).toBe('Draft 2');
    expect(nextBeatVersionName({ revisionName: 'v4', revisions: [{ name: 'v5' }] })).toBe('v6');
    expect(nextBeatVersionName({ revisionName: 'Opening', revisions: [] })).toBe('Draft 2');
  });

  it('fingerprints text, and diffs words', () => {
    expect(beatHash(master)).toBe(beatHash(seg(...master.elements)));
    expect(beatHash(master)).not.toBe(beatHash(ab));
    const parts = wordDiff('She opens the letter and leaves.', 'She opens the letter, hesitates.');
    expect(parts.some((one) => one.kind === 'removed')).toBe(true);
    expect(parts.some((one) => one.kind === 'added')).toBe(true);
    expect(passageText(master, { startElementId: 'e2', startOffset: 4, endElementId: 'e1', endOffset: 4 })).toBe('opens the letter and leaves.\nThe ');
  });
});

describe('a task’s passage, found again in the draft (§37)', () => {
  it('finds it where it was, where it moved, and marks the lines where the words changed', async () => {
    const d = await import('../index.js');
    const el = (id: string, text: string) => ({ id: id as never, type: 'dialogue' as const, text, characterId: null, attributes: {} });
    const passage = { startElementId: 'b', startOffset: 0, endElementId: 'b', endOffset: 11, quote: 'Tides turn.' };
    const same = { elements: [el('a', 'He said so.'), el('b', 'Tides turn. Twice.')] };
    expect(d.findPassageInDraft(same, passage)).toEqual({ ranges: [{ elementId: 'b', from: 0, to: 11 }], how: 'exact' });

    const moved = { elements: [el('a', 'He said so.'), el('b', 'Oh. Tides turn. Twice.')] };
    expect(d.findPassageInDraft(moved, passage)).toEqual({ ranges: [{ elementId: 'b', from: 4, to: 15 }], how: 'moved' });

    const changed = { elements: [el('a', 'He said so.'), el('b', 'The sea comes back.')] };
    expect(d.findPassageInDraft(changed, passage)).toEqual({ ranges: [{ elementId: 'b', from: 0, to: 19 }], how: 'lines' });

    expect(d.findPassageInDraft({ elements: [el('z', 'Nothing here.')] }, passage)).toBeNull();
  });
});
