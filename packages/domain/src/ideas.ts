import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { orderKeyBetween } from './ordering.js';
import { researchItemSchema } from './entities/research.js';
import { researchItemsIn } from './selectors.js';
import { seatName, type Seat } from './room.js';
import { originNow } from './attribution.js';
import type { ProjectFile } from './project-file.js';
import type { ResearchItem } from './entities/research.js';
import type { ResearchCategory } from './entities/research.js';
import type { ResearchCategoryId, ResearchItemId } from './ids.js';
import type { Submission } from './submission.js';

/**
 * The brainstorming room (addendum 07 §11, stage 7).
 *
 * Ken: *when they wanna submit either research or the ideas,
 * characterizations, ideas for a story, that goes to the showrunner's
 * brainstorming research area. When everyone submits, then they consider it
 * out and talk about it from the showrunner's screen. And you can see whose
 * ideas are what, because they're colorized and the boxes are colorized.*
 *
 * **This is a second destination, not a second Curation Tray**, and the
 * difference is real: the tray assembles a *script* (§12), and this is where a
 * room argues about *what the story is* before there is a script to assemble.
 *
 * The rule that shapes the whole file: **filing does not consume it.** A
 * submission that has been filed into the project's research is still a
 * submission, still attributed, still findable — §1 is about ideas as much as
 * it is about pages. So filing *copies into* the research and leaves the
 * submission where it is, marked as taken up.
 */

/** One writer's ideas, as the room sees them: a box, in their colour. */
export interface IdeaBox {
  submission: Submission;
  seat: Seat | null;
  /** The items it carries, read out of the version it was taken from. */
  items: ResearchItem[];
  /** Whether the room has already taken these up. */
  filed: boolean;
}

/**
 * The research a submitted version carries.
 *
 * Read out of the document rather than sent separately: a submission
 * references a version, and a version is the whole project as it stood. What
 * the room wants to look at is the research in it.
 */
export const ideasIn = (file: ProjectFile): ResearchItem[] =>
  file.researchItems.filter((item) => !item.archived);

/**
 * Whose idea this is, for the colour.
 *
 * The item's own author where it has one, and the sender's otherwise — a
 * writer who sends research they made before the room existed is still the
 * person the room is looking at.
 */
export const ideaAuthorId = (item: ResearchItem, submission: Submission): string =>
  item.author?.authorId ?? submission.authorId;

/** What to call the person whose box this is. */
export const boxName = (box: IdeaBox): string =>
  box.seat ? seatName(box.seat) : 'Somebody no longer in the room';

/** The colour a box wears, or a quiet grey where the room does not know them. */
export const boxColour = (box: IdeaBox): string => box.seat?.colour || '#666666';

/**
 * What is in the room's ideas, oldest first.
 *
 * The same order the review queue uses and for the same reason: the oldest is
 * who has been waiting longest to be talked about.
 */
export const ideaBoxes = (input: {
  submissions: readonly Submission[];
  seats: readonly Seat[];
  itemsFor(submission: Submission): ResearchItem[];
}): IdeaBox[] =>
  input.submissions
    .filter((submission) => submission.kind === 'research')
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
    .map((submission) => ({
      submission,
      seat: input.seats.find((seat) => seat.userId === submission.authorId) ?? null,
      items: input.itemsFor(submission),
      filed: submission.state === 'incorporated',
    }));

// --------------------------------------------------------------- filing it

export type FileRefusal = { reason: 'no_such_category' } | { reason: 'nothing_chosen' };

export const fileRefusalText = (refusal: FileRefusal): string =>
  refusal.reason === 'no_such_category'
    ? 'That heading is not in this project’s research.'
    : 'Nothing was chosen to file.';

/**
 * Take ideas into the project's own research (§11).
 *
 * **It copies; it never moves.** The submission stays exactly where it is —
 * this returns a project with the chosen items added to it, and says nothing
 * about the submission at all. Whoever calls it marks the submission taken up,
 * and that marking is a fact about the *room*, not about the research.
 *
 * Two things travel with each item and both matter. Its **author**, so the box
 * keeps its colour wherever it is looked at afterwards; and its **title and
 * body unchanged**, because a showrunner filing somebody's idea is agreeing
 * with it, not rewriting it.
 *
 * A new id every time, deliberately: the filed item is the project's, the
 * submitted one is still the writer's, and sharing an id between them would
 * make editing one silently edit the other.
 */
export const fileIdeas = (
  file: ProjectFile,
  input: {
    items: readonly ResearchItem[];
    categoryId: ResearchCategoryId;
    /** Whose ideas these are, where the items do not say for themselves. */
    authorId: string;
    at?: string;
  },
): ProjectFile | FileRefusal => {
  if (input.items.length === 0) return { reason: 'nothing_chosen' };
  const category = file.researchCategories.find((one) => one.id === input.categoryId);
  if (!category) return { reason: 'no_such_category' };

  const at = input.at ?? nowIso();
  const existing = researchItemsIn(file, { categoryId: input.categoryId });
  let after = existing[existing.length - 1]?.orderKey ?? null;

  const filed: ResearchItem[] = input.items.map((item) => {
    const orderKey = orderKeyBetween(after, null);
    after = orderKey;
    return researchItemSchema.parse({
      ...item,
      id: newId<ResearchItemId>(),
      projectId: file.project.id,
      categoryId: input.categoryId,
      orderKey,
      // Whose idea it was, kept so the box keeps its colour in the project it
      // has been filed into.
      author: item.author ?? originNow(input.authorId, at),
      createdAt: at,
      updatedAt: at,
    });
  });

  return {
    ...file,
    researchItems: [...file.researchItems, ...filed],
    project: { ...file.project, updatedAt: at },
  };
};

/** The headings a submission can be filed under, in the project's own order. */
export const filingChoices = (file: ProjectFile): ResearchCategory[] =>
  [...file.researchCategories]
    .filter((category) => !category.archived)
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));

/**
 * What the room is told about a box it has taken up.
 *
 * Said in the way §11 asks for: filing is not consuming. A showrunner looking
 * at a filed box should see that it was taken up *and* that it is still here.
 */
export const filedNote = (box: IdeaBox): string =>
  box.filed
    ? 'Taken into the project’s research. Still here, still theirs.'
    : 'Not filed yet. Reading it changes nothing.';
