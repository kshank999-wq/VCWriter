import { addItem, addResearchRow, createOutline, findOutline, outlinesOf } from './outline.js';
import { isInstructional } from './formats.js';
import { cardsIn, moveCard, sortCategories } from './note-sorter.js';
import { onlyLiving } from './graveyard.js';
import type { OutlineId, OutlineItemId, NoteSessionId, ResearchCategoryId, ResearchItemId } from './ids.js';
import type { ProjectFile } from './project-file.js';
import type { ProjectFormat } from './entities/project.js';

/**
 * Send to Outliner (addendum 26 §11), the point of the whole module: a sitting
 * of sorted cards becomes a structure a writer can write from.
 *
 * The audit paid a **twenty-fifth** time and paid most of the stage. The
 * handoff asks for *cards become attached notes… Outline items link back to
 * their cards, and cards link back to their source words*, and **that is
 * `addResearchRow`**, built for addendum 06 §5: a row whose `source` names a
 * research item, whose title is **read through** to it rather than copied, and
 * which is a reference rather than a duplicate — so *after sending, cards stay
 * in the sorter* needs nothing at all. The other end of the sentence is
 * `sourceFrom`/`sourceTo`, which is how a card already knows its words.
 *
 * So what is new here is the **ladder** and one act.
 *
 * **There is no writing mode picker, because the project has already answered
 * that question.** The handoff asks for one that *sets the mapping*, which is
 * right in a standalone tool and would be a second answer here: this program
 * has had a format since the first migration and `nounsFor` has named its
 * levels since addendum 16 §1. A sitting that said *Book · nonfiction* inside a
 * screenplay would be two claims about one work, free to disagree. What the
 * handoff really wants from that control is the **per-row override**, which it
 * asks for in the next sentence and which is built.
 */

/** What a category or a card becomes, by the level it stands at. */
export interface SendLadder {
  /** A top-level category. */
  top: string;
  /** A category inside one. */
  sub: string;
  /** A card. */
  card: string;
}

/**
 * The default mapping, read off the format (§11).
 *
 * **A chapter where the format has one, otherwise the unit**, and the level
 * under it is the next noun down — which is `kindsFor`'s own list read as a
 * ladder rather than as a menu. Nothing here names a level: on a textbook the
 * rungs draw as Chapter and Section, on a novel as Chapter and Passage, on a
 * screenplay as Scene and Beat, and the table is the only thing that decides.
 *
 * A card is a **note** on every format. It is the type that claims least about
 * what the thing is (`kindForResearch`'s own reason), and a passage a writer
 * highlighted out of a brainstorm is not yet a scene.
 */
export const sendLadder = (format: ProjectFormat): SendLadder =>
  isInstructional(format)
    ? { top: 'chapter', sub: 'scene', card: 'note' }
    : { top: 'scene', sub: 'beat', card: 'note' };

/** A row of the picker, and of the preview beside it. */
export interface SendRow {
  kind: 'category' | 'card';
  /** The category's or the card's own id. */
  id: string;
  /** The row above it, or null at the top. */
  parentId: string | null;
  depth: number;
  title: string;
  /** The outline kind it would become. */
  becomes: string;
  /** How many cards are filed here. A category only. */
  cards: number;
  /** Whether it is going. */
  sent: boolean;
}

/**
 * What the writer has said about a send.
 *
 * **Only what is off is written down** (addendum 20 §9v's rule): a category
 * made after the picker was opened belongs in the send without being asked, and
 * a list of what is *in* would silently drop it.
 *
 * None of it is stored. A plan is about this send rather than about the work,
 * so it lives in the screen and goes when the screen does.
 */
export interface SendChoices {
  /** Row ids the writer has switched off. */
  out?: readonly string[];
  /** Per-row overrides of what it becomes. */
  becomes?: Readonly<Record<string, string>>;
}

/**
 * The sitting as rows, in the order they would go in (§11).
 *
 * A category nested under another is a rung down; a card hangs under the
 * category it is filed in. **A card referenced into a second category is listed
 * under both**, because that is what the reference says and the outline can
 * carry the same card twice — `addResearchRow`'s own rule, a reference not
 * being a claim.
 *
 * **A row switched off takes what is under it**, which is said rather than
 * implied: an unticked category's cards do not quietly arrive at the top level.
 */
export const sendRows = (
  file: ProjectFile,
  sessionId: NoteSessionId,
  format: ProjectFormat,
  choices: SendChoices = {},
): SendRow[] => {
  const ladder = sendLadder(format);
  const out = new Set(choices.out ?? []);
  const said = choices.becomes ?? {};
  // The writer's own categories, never the unsorted pile: the pile is what a
  // deleted category's cards fall into, so sending it would arrive as a chapter
  // called Unsorted. The screen says so rather than letting it look like a loss.
  const categories = sortCategories(file, sessionId);
  const rows: SendRow[] = [];

  const walk = (parentId: ResearchCategoryId | null, depth: number, parentSent: boolean): void => {
    for (const category of categories.filter(
      (one) => ((one.parentId ?? null) as string | null) === ((parentId ?? null) as string | null),
    )) {
      const id = category.id as string;
      const cards = cardsIn(file, category.id);
      const sent = parentSent && !out.has(id);
      rows.push({
        kind: 'category',
        id,
        parentId: (parentId ?? null) as string | null,
        depth,
        title: category.name,
        becomes: said[id] ?? (depth === 0 ? ladder.top : ladder.sub),
        cards: cards.length,
        sent,
      });
      for (const card of cards) {
        const cardId = `${id}:${card.id as string}`;
        rows.push({
          kind: 'card',
          id: cardId,
          parentId: id,
          depth: depth + 1,
          title: card.title,
          becomes: said[cardId] ?? ladder.card,
          cards: 0,
          sent: sent && !out.has(cardId),
        });
      }
      walk(category.id, depth + 1, sent);
    }
  };

  walk(null, 0, true);
  return rows;
};

/** What a send would make, counted. */
export interface SendCount {
  /** How many of each kind would arrive. */
  byKind: Record<string, number>;
  /** "8 chapters · 2 sections · 28 notes", in the format's own words. */
  says: string;
  /** How many rows in all. */
  total: number;
}

/**
 * What the send would do, said before it is asked for (`trackRemoval`'s shape).
 *
 * The names come from the caller, because naming a kind is the noun table's
 * business and the domain has no business spelling *Section*. A plan with
 * nothing ticked **says so** rather than reading as ready.
 */
export const sendCount = (
  rows: readonly SendRow[],
  nameOf: (kind: string, many: boolean) => string,
): SendCount => {
  const byKind: Record<string, number> = {};
  for (const row of rows) {
    if (!row.sent) continue;
    byKind[row.becomes] = (byKind[row.becomes] ?? 0) + 1;
  }
  const parts = Object.entries(byKind).map(
    ([kind, n]) => `${n} ${nameOf(kind, n !== 1).toLowerCase()}`,
  );
  const total = Object.values(byKind).reduce((sum, n) => sum + n, 0);
  return {
    byKind,
    says: total === 0 ? 'Nothing is ticked, so nothing would be sent.' : parts.join(' · '),
    total,
  };
};

/**
 * Send the sitting into an outline (§11).
 *
 * **A category becomes a row of its own and a card becomes a reference**, which
 * is the difference that makes the whole thing safe to press: the structure is
 * new writing in the outline, and the notes are the notes — one record, read
 * through, so editing a card in Refine changes what the outline says and
 * nothing has to be kept in step.
 *
 * Two rules the outline already held and this obeys rather than works around.
 * **A chapter cannot hang under anything** (`mayHang`, addendum 19 §2), so a
 * nested category asking to be a chapter arrives as the rung under it instead
 * — refusing the row outright would drop the writer's cards for a reason about
 * type. And **nothing is destroyed**: a send adds rows and never clears the
 * outline, so sending twice gives two copies rather than losing the first,
 * which is what Undo is for.
 */
export const sendToOutliner = (
  file: ProjectFile,
  sessionId: NoteSessionId,
  format: ProjectFormat,
  choices: SendChoices = {},
  outlineId?: OutlineId,
): { file: ProjectFile; outlineId: OutlineId | null; made: number } => {
  let next = file;
  let target = outlineId ?? outlinesOf(file)[0]?.id ?? null;
  if (target === null) {
    const born = createOutline(next, { name: 'Outline' });
    next = born.file;
    target = born.outline.id;
  }
  if (!findOutline(next, target)) return { file, outlineId: null, made: 0 };

  const rows = sendRows(file, sessionId, format, choices);
  /** The outline row each sorter row landed as, so children find their parent. */
  const landed = new Map<string, OutlineItemId>();
  let made = 0;

  for (const row of rows) {
    if (!row.sent) continue;
    const parent = row.parentId === null ? null : landed.get(row.parentId) ?? null;
    // A row whose parent went nowhere goes nowhere: a switched-off category
    // takes what is under it, and `sendRows` has already said so.
    if (row.parentId !== null && parent === null) continue;
    // `mayHang` refuses a chapter under a parent. Step it down rather than drop
    // the row, since the writer asked for the card and not for the type.
    const kind = row.becomes === 'chapter' && parent !== null ? sendLadder(format).sub : row.becomes;

    if (row.kind === 'card') {
      const cardId = row.id.slice(row.id.indexOf(':') + 1) as ResearchItemId;
      const put = addResearchRow(next, target, cardId, { parentId: parent });
      if (put.itemId === null) continue;
      next = put.file;
      landed.set(row.id, put.itemId);
      made += 1;
      continue;
    }

    const put = addItem(next, target, { parentId: parent, kind, title: row.title });
    if (put.itemId === null) continue;
    next = put.file;
    landed.set(row.id, put.itemId);
    made += 1;
  }

  return { file: next, outlineId: target, made };
};

/**
 * Put one card on the research shelf (§12, the handoff's *also send single
 * cards somewhere else*).
 *
 * **It moves the card's home rather than listing it twice**, and the reason is
 * a fact about the rest of the program: every research reading answers *what is
 * on this shelf* from a card's `categoryId`, so a card merely referenced into a
 * folder would be invisible in the one place the act exists to put it. One
 * home, and the outline row is the second place it appears — which still holds,
 * a row referencing the card by id and reading its title through.
 *
 * The sitting does not lose the passage: the card keeps its range, so the
 * source's grey does not move, which is `removeSortCategory`'s promise from the
 * other end.
 */
export const fileOnShelf = (
  file: ProjectFile,
  cardId: ResearchItemId,
  categoryId: ResearchCategoryId,
): ProjectFile => moveCard(file, cardId, categoryId);

/** What a writer is told before they press it. */
export const shelfOffer = (
  file: ProjectFile,
  cardId: ResearchItemId,
  categoryId: ResearchCategoryId,
): { can: boolean; says: string } => {
  const card = onlyLiving(file.researchItems).find((one) => (one.id as string) === (cardId as string));
  if (!card) return { can: false, says: 'That card is not there.' };
  const folder = file.researchCategories.find((one) => (one.id as string) === (categoryId as string));
  if (!folder) return { can: false, says: 'That folder is not there.' };
  if (folder.sessionId !== null) {
    return { can: false, says: 'That is one of this sitting’s categories rather than a shelf.' };
  }
  return {
    can: true,
    says: `It joins ${folder.name} on the shelf and leaves this sitting. An outline row still reads it, and the source keeps its grey.`,
  };
};
