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
