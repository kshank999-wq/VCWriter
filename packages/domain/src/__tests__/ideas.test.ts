import { describe, expect, it } from 'vitest';
import {
  addResearchItem,
  boxColour,
  boxName,
  createProjectFile,
  fileIdeas,
  fileRefusalText,
  filedNote,
  filingChoices,
  ideaAuthorId,
  ideaBoxes,
  ideasIn,
  originNow,
  researchItemsIn,
  ROOM_COLOURS,
  seatSchema,
  submissionSchema,
  type ProjectFile,
  type ResearchItem,
  type Seat,
  type Submission,
} from '../index.js';

/**
 * The brainstorming room (addendum 07 §11, stage 7).
 *
 * One rule carries the file and it is easy to break by accident: **filing does
 * not consume it.** A submission taken into the project's research is still a
 * submission, still attributed, still findable — §1 is about ideas as much as
 * about pages. So filing *copies*, and the copy keeps whose idea it was.
 */

const AT = '2026-09-12T00:00:00.000Z';

const seat = (over: Partial<Seat>): Seat =>
  seatSchema.parse({ id: 's', roomId: 'r', email: '', invitedAt: AT, createdAt: AT, updatedAt: AT, ...over });

const JO = seat({ id: 's1', userId: 'jo', displayName: 'Jo Calder', colour: ROOM_COLOURS[1] });

const sent = (over: Partial<Submission> = {}): Submission =>
  submissionSchema.parse({
    id: 'sub-1',
    roomId: 'r',
    versionId: 'v1',
    authorId: 'jo',
    kind: 'research',
    createdAt: AT,
    updatedAt: AT,
    ...over,
  });

/** A project with two ideas in it. */
const withIdeas = (): { file: ProjectFile; items: ResearchItem[] } => {
  const empty = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  const ideas = empty.researchCategories.find((one) => one.systemKey === 'ideas')!;
  const one = addResearchItem(empty, { categoryId: ideas.id, title: 'The case is empty', body: 'All along.' });
  const two = addResearchItem(one, { categoryId: ideas.id, title: 'Mara knew', body: '' });
  return { file: two, items: researchItemsIn(two, { categoryId: ideas.id }) };
};

describe('what is in the room’s ideas', () => {
  it('takes research submissions and leaves the script ones to the queue', () => {
    const boxes = ideaBoxes({
      submissions: [sent({ id: 'a' }), sent({ id: 'b', kind: 'script' })],
      seats: [JO],
      itemsFor: () => [],
    });
    expect(boxes.map((box) => box.submission.id)).toEqual(['a']);
  });

  it('is oldest first — who has waited longest to be talked about', () => {
    const boxes = ideaBoxes({
      submissions: [sent({ id: 'new', createdAt: '2026-09-20T00:00:00.000Z' }), sent({ id: 'old', createdAt: AT })],
      seats: [JO],
      itemsFor: () => [],
    });
    expect(boxes.map((box) => box.submission.id)).toEqual(['old', 'new']);
  });

  it('wears its writer’s colour, and a quiet grey for somebody the room lost', () => {
    const [mine] = ideaBoxes({ submissions: [sent()], seats: [JO], itemsFor: () => [] });
    expect(boxColour(mine!)).toBe(ROOM_COLOURS[1]);
    expect(boxName(mine!)).toBe('Jo Calder');

    const [orphan] = ideaBoxes({ submissions: [sent()], seats: [], itemsFor: () => [] });
    expect(boxColour(orphan!)).toBe('#666666');
    expect(boxName(orphan!)).toContain('no longer in the room');
  });

  it('reads the ideas out of the version, skipping what was archived', () => {
    const { file, items } = withIdeas();
    const archived: ProjectFile = {
      ...file,
      researchItems: file.researchItems.map((item) =>
        item.id === items[0]!.id ? { ...item, archived: true } : item,
      ),
    };
    expect(ideasIn(archived).map((item) => item.title)).not.toContain('The case is empty');
  });

  it('falls back to the sender where an item does not say whose it is', () => {
    const { items } = withIdeas();
    expect(ideaAuthorId(items[0]!, sent({ authorId: 'mara' }))).toBe('mara');
    const theirs = { ...items[0]!, author: originNow('jo', AT) };
    expect(ideaAuthorId(theirs, sent({ authorId: 'mara' }))).toBe('jo');
  });
});

describe('filing does not consume it', () => {
  it('copies the ideas into the project and keeps whose they were', () => {
    const { file, items } = withIdeas();
    const characters = filingChoices(file).find((one) => one.systemKey === 'characters')!;

    const filed = fileIdeas(file, { items, categoryId: characters.id, authorId: 'jo', at: AT });
    if ('reason' in filed) throw new Error('it refused');

    const now = researchItemsIn(filed, { categoryId: characters.id });
    expect(now.map((item) => item.title)).toEqual(['The case is empty', 'Mara knew']);
    expect(now.every((item) => item.author?.authorId === 'jo')).toBe(true);
  });

  it('gives the copy its own id, so editing one never edits the other', () => {
    const { file, items } = withIdeas();
    const characters = filingChoices(file).find((one) => one.systemKey === 'characters')!;
    const filed = fileIdeas(file, { items, categoryId: characters.id, authorId: 'jo', at: AT });
    if ('reason' in filed) throw new Error('it refused');

    const ids = new Set(filed.researchItems.map((item) => item.id as string));
    expect(ids.size).toBe(filed.researchItems.length);
    // The originals are untouched and still where they were.
    expect(researchItemsIn(filed, { categoryId: items[0]!.categoryId }).map((one) => one.title)).toEqual([
      'The case is empty',
      'Mara knew',
    ]);
  });

  it('keeps an idea’s own author rather than crediting whoever filed it', () => {
    const { file, items } = withIdeas();
    const characters = filingChoices(file).find((one) => one.systemKey === 'characters')!;
    const theirs = items.map((item) => ({ ...item, author: originNow('mara', AT) }));

    const filed = fileIdeas(file, { items: theirs, categoryId: characters.id, authorId: 'ken', at: AT });
    if ('reason' in filed) throw new Error('it refused');
    expect(
      researchItemsIn(filed, { categoryId: characters.id }).every((item) => item.author?.authorId === 'mara'),
    ).toBe(true);
  });

  it('files them in order, after whatever is already under the heading', () => {
    const { file, items } = withIdeas();
    const characters = filingChoices(file).find((one) => one.systemKey === 'characters')!;
    const sitting = addResearchItem(file, { categoryId: characters.id, title: 'Already here' });

    const filed = fileIdeas(sitting, { items, categoryId: characters.id, authorId: 'jo', at: AT });
    if ('reason' in filed) throw new Error('it refused');
    expect(researchItemsIn(filed, { categoryId: characters.id }).map((one) => one.title)).toEqual([
      'Already here',
      'The case is empty',
      'Mara knew',
    ]);
  });

  it('refuses a heading the project does not have, and says which', () => {
    const { file, items } = withIdeas();
    const refused = fileIdeas(file, { items, categoryId: 'nowhere' as never, authorId: 'jo' });
    expect('reason' in refused && refused.reason).toBe('no_such_category');
    expect(fileRefusalText({ reason: 'no_such_category' })).toContain('not in this project');
  });

  it('refuses an empty handful rather than quietly doing nothing', () => {
    const { file } = withIdeas();
    const heading = filingChoices(file)[0]!;
    const refused = fileIdeas(file, { items: [], categoryId: heading.id, authorId: 'jo' });
    expect('reason' in refused && refused.reason).toBe('nothing_chosen');
  });
});

describe('what the room is told about a box', () => {
  it('says a filed box is still here and still theirs', () => {
    const [box] = ideaBoxes({ submissions: [sent({ state: 'incorporated' })], seats: [JO], itemsFor: () => [] });
    expect(box!.filed).toBe(true);
    expect(filedNote(box!)).toContain('Still here, still theirs');
  });

  it('says reading one changes nothing, which is the thing to promise', () => {
    const [box] = ideaBoxes({ submissions: [sent()], seats: [JO], itemsFor: () => [] });
    expect(filedNote(box!)).toContain('changes nothing');
  });
});
