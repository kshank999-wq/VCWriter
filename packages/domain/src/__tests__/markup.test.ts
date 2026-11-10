import { describe, expect, it } from 'vitest';
import {
  describeMark,
  markFromSelection,
  marksOn,
  markupSchema,
  noticeForMarkup,
  seatSchema,
  segmentsFor,
  unseenMarkups,
  type Mark,
} from '../index.js';

/** Marking up a version (addendum 07 §27). */

const mark = (over: Partial<Mark> & Pick<Mark, 'start' | 'end'>): Mark => {
  const made = markFromSelection({
    id: over.id ?? 'm1',
    elementId: over.elementId ?? 'e1',
    text: 'She opens the door and the room is empty.',
    start: over.start,
    end: over.end,
    kind: over.kind ?? 'highlight',
    note: over.note,
    replacement: over.replacement,
  });
  if ('reason' in made) throw new Error(made.reason);
  return made;
};

describe('making a mark', () => {
  it('keeps the words it was made on', () => {
    expect(mark({ start: 4, end: 9 }).quote).toBe('opens');
  });

  it('refuses an empty highlight, and a note or suggestion with nothing said', () => {
    const base = { id: 'x', elementId: 'e', text: 'Hello there', start: 2, end: 2 };
    expect(markFromSelection({ ...base, kind: 'highlight' })).toEqual({ reason: 'empty' });
    expect(markFromSelection({ ...base, start: 0, end: 5, kind: 'suggest' })).toEqual({ reason: 'needs_words' });
    expect(markFromSelection({ ...base, kind: 'note', note: 'Too long' })).not.toHaveProperty('reason');
  });

  it('reads a selection made backwards the right way round', () => {
    const made = markFromSelection({ id: 'x', elementId: 'e', text: 'Hello there', start: 5, end: 0, kind: 'strike' });
    expect(made).toMatchObject({ start: 0, end: 5, quote: 'Hello' });
  });
});

describe('drawing marks on a line', () => {
  it('cuts the line where marks begin and end, and carries overlapping marks together', () => {
    const one = mark({ id: 'a', start: 0, end: 9 });
    const two = mark({ id: 'b', start: 4, end: 13, kind: 'strike' });
    const segments = segmentsFor('She opens the door and the room is empty.', [one, two]);
    expect(segments.map((segment) => segment.text)).toEqual(['She ', 'opens', ' the', ' door and the room is empty.']);
    expect(segments[1]!.marks.map((m) => m.id)).toEqual(['a', 'b']);
    expect(segments[3]!.marks).toEqual([]);
  });

  it('never loses a mark on a line that has since got shorter', () => {
    const late = mark({ start: 30, end: 41 });
    const segments = segmentsFor('She opens the door and the room', [late]);
    expect(segments.at(-1)!.marks).toHaveLength(1);
  });

  it('lists an element’s marks in reading order', () => {
    const later = mark({ id: 'later', start: 20, end: 24 });
    const sooner = mark({ id: 'sooner', start: 0, end: 3 });
    expect(marksOn([later, sooner], 'e1').map((m) => m.id)).toEqual(['sooner', 'later']);
  });

  it('says a suggestion as the words and what to put instead', () => {
    expect(describeMark(mark({ start: 4, end: 9, kind: 'suggest', replacement: 'kicks open' }))).toBe('“opens” → “kicks open”');
  });
});

describe('sending it back', () => {
  const seats = [
    seatSchema.parse({ id: 's1', roomId: 'r', userId: 'writer', email: 'jo@example.com', displayName: 'Jo', role: 'writer', state: 'active', notifyByEmail: true, invitedAt: '2026-11-01T00:00:00Z', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' }),
  ];
  const markup = markupSchema.parse({
    id: 'mk',
    roomId: 'r',
    versionId: 'v',
    authorId: 'showrunner',
    recipientId: 'writer',
    marks: [mark({ start: 0, end: 3 })],
    note: 'Tighter in the middle.',
    sentAt: '2026-11-09T00:00:00Z',
    createdAt: '2026-11-09T00:00:00Z',
  });

  it('tells the writer, with the covering note, and links straight to it', () => {
    const notice = noticeForMarkup({ markup, seats, roomName: 'Blackout', versionLabel: 'Jo’s pass' });
    expect(notice?.to.userId).toBe('writer');
    expect(notice?.line).toContain('one mark');
    expect(notice?.said).toBe('Tighter in the middle.');
    expect(notice?.path).toBe('/rooms/r?view=markups&markup=mk');
  });

  it('does not mail somebody about marking up their own version', () => {
    expect(noticeForMarkup({ markup: { ...markup, authorId: 'writer' }, seats, roomName: 'B', versionLabel: 'v' })).toBeNull();
  });

  it('counts what is waiting for each person, and only for them', () => {
    expect(unseenMarkups([markup], 'writer')).toHaveLength(1);
    expect(unseenMarkups([{ ...markup, state: 'seen' }], 'writer')).toHaveLength(0);
    expect(unseenMarkups([markup], 'showrunner')).toHaveLength(0);
  });
});

describe('bringing a markup into the script', () => {
  it('adds a draft named for the writer to each marked beat, and leaves the rest alone', async () => {
    const { bringInMarkup, markupDraftLabel, isMarkupDraft, archiveRevision, createProjectFile, addUnit, addBeat, updateBeat } =
      await import('../index.js');
    const empty = createProjectFile({ title: 'Room', format: 'screenplay' });
    const scene = addUnit({ ...empty, units: [], beats: [] }, { trackId: empty.tracks[0]!.id, title: 'INT. HOUSE - NIGHT' });
    const one = addBeat(scene.file, { unitId: scene.unit.id, title: 'One' });
    const two = addBeat(one.file, { unitId: scene.unit.id, title: 'Two' });
    const line = (id: string, text: string) => ({ id, type: 'action', text, characterId: null, attributes: {} });
    let base = updateBeat(two.file, one.beat.id, { manuscript: { elements: [line('e1', 'She opens the door.')] } } as never);
    base = updateBeat(base, two.beat.id, { manuscript: { elements: [line('e2', 'Nobody is there.')] } } as never);
    // The writer's version reworded the first beat.
    const source = updateBeat(base, one.beat.id, { manuscript: { elements: [line('e1', 'She kicks the door open.')] } } as never);

    const marks = [mark({ elementId: 'e1', start: 4, end: 9 })];
    const result = bringInMarkup(base, { source, marks, label: markupDraftLabel('MA'), markedBy: 'Ken' });
    expect(result).toMatchObject({ beats: 1, missing: 0 });

    const first = result.file.beats.find((beat) => beat.id === one.beat.id)!;
    const added = first.revisions.at(-1)!;
    expect(added.name).toBe('MA markup');
    expect(added.markedBy).toBe('Ken');
    expect(isMarkupDraft(added)).toBe(true);
    // The marked draft holds the writer's words; the working draft is untouched.
    expect(added.manuscript.elements[0]!.text).toBe('She kicks the door open.');
    expect(first.manuscript.elements[0]!.text).toBe('She opens the door.');
    // The beat the marks did not touch gains nothing.
    expect(result.file.beats.find((beat) => beat.id === two.beat.id)!.revisions).toHaveLength(0);

    const again = bringInMarkup(result.file, { source, marks, label: 'MA markup', markedBy: 'Ken' });
    expect(again.file.beats.find((beat) => beat.id === one.beat.id)!.revisions.at(-1)!.name).toBe('MA markup 2');

    const archived = archiveRevision(result.file, one.beat.id, added.id, true);
    const kept = archived.beats.find((beat) => beat.id === one.beat.id)!.revisions.at(-1)!;
    expect(kept.archived).toBe(true);
    expect(kept.marks).toHaveLength(1);
  });
});

describe('marking up in the beat writing screen', () => {
  it('keeps the marks as a draft named for whoever made them, with a copy of the text', async () => {
    const { addMarkupDraft, initialsOf, createProjectFile, addUnit, addBeat, updateBeat } = await import('../index.js');
    expect(initialsOf('Ken  Shank')).toBe('KS');
    const empty = createProjectFile({ title: 'Mine', format: 'screenplay' });
    const scene = addUnit({ ...empty, units: [], beats: [] }, { trackId: empty.tracks[0]!.id, title: 'EXT. ROAD - DAY' });
    const made = addBeat(scene.file, { unitId: scene.unit.id, title: 'Road' });
    const file = updateBeat(made.file, made.beat.id, {
      manuscript: { elements: [{ id: 'e1', type: 'action', text: 'She opens the door.', characterId: null, attributes: {} }] },
    } as never);
    const marks = [mark({ elementId: 'e1', start: 4, end: 9 })];
    const next = addMarkupDraft(file, { beatId: made.beat.id as string, marks, markedBy: 'Ken Shank' });
    const beat = next.beats.find((one) => one.id === made.beat.id)!;
    expect(beat.revisions.at(-1)).toMatchObject({ name: 'KS markup', markedBy: 'Ken Shank', archived: false });
    expect(beat.revisions.at(-1)!.manuscript).toEqual(beat.manuscript);
    expect(addMarkupDraft(file, { beatId: made.beat.id as string, marks: [], markedBy: 'Ken' })).toBe(file);
  });
});
