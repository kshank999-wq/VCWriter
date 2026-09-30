import { markForIndex, sameHeading } from './book-index.js';
import { workingCast } from './characters.js';
import { onlyLiving } from './graveyard.js';
import { beatsInStoryOrder } from './selectors.js';
import type { ProjectFile } from './project-file.js';
import type { UsageLink } from './character-creator.js';
import type { BeatId, ManuscriptElementId } from './ids.js';

/**
 * Building the index out of the book (addendum 10 §8).
 *
 * From Ken, twice in the same words: *build the real index*. What he was
 * looking at was a page headed **Index** with nothing under it, on a book he
 * had written and imported and laid out — and he was right that it is not a
 * real index. It was not broken: `bookIndexOf` reads the marks, the laying
 * hands them to the page, and the page prints them. There were no marks,
 * because the only way to make one was to right-click a passage, and nobody
 * does that four hundred times.
 *
 * **§2 is kept and read properly.** *A mark is an anchor the writer places and
 * never a search* is right about what an index is, and it had been read as
 * *and so the program offers nothing to start from*. Those are two different
 * claims, and the second does not follow — it is addendum 25 §4b's correction
 * in another room (an argument about where the work comes from, dressed up as
 * an argument about what an index is). Indexing every occurrence of a word
 * would still be a concordance and is still refused. What this does instead:
 *
 * **The writer has already placed the anchors, in other rooms.** Every
 * characterization moment pinned to a paragraph, every arc point, every theme
 * and motif tagged in the manuscript, every moment on a story thread is a
 * `usage_link` carrying an owner, a beat, an element and a quote — somebody
 * deliberately pointing at a passage and saying *this one*. That is precisely
 * what an index mark is, made in a different room for a different reason. The
 * index was empty not because the work had not been done but because the work
 * that had been done was invisible to it.
 *
 * So there is no search anywhere in this file, no word counting, and nothing
 * that reads the manuscript's text at all. It reads **anchors**, groups them
 * under the record that owns them, and offers the writer a heading per record.
 *
 * Three rules hold it.
 *
 * **Only an anchor that names a passage.** A pin made against the whole beat
 * carries no `elementId` and means *somewhere in this scene*; filing it
 * against the first paragraph would invent a position the writer did not give,
 * which is what `passageMarks` refuses for the margin and is refused here for
 * the same reason. A location is **absent** for exactly this: `usedIn` reads
 * scene headings, so a place has scenes and not passages.
 *
 * **It proposes; it never files.** Nothing here writes to the project until
 * `acceptProposal` is called on one heading, which is the one act. Nothing
 * about a proposal is stored — cut the passage and the proposal shrinks, take
 * the pin off and it goes, with nothing run.
 *
 * **It adds and never overwrites.** A heading already in the index is said
 * rather than doubled, and a passage already marked under it is left alone, so
 * a second press changes nothing. `back-matter-pull.ts`'s rule, which is the
 * same act at the other end of the book.
 */

// ------------------------------------------------------------ what it finds

/** One passage a proposal would mark. */
export interface ProposedPlace {
  beatId: BeatId;
  elementId: ManuscriptElementId;
  /** What the passage said when it was pinned. For reading, never for finding. */
  quote: string;
  /** Whether this one is already marked under this heading. */
  already: boolean;
}

/**
 * A heading the book could carry, and the passages under it.
 *
 * Named for the **record** rather than for the mark, because that is what
 * makes it checkable: a writer reading *Silas Crane · Miserly · 4 passages*
 * knows exactly which of their own work it came from, where *4 mentions of
 * “miser”* would be a number they would have to go and verify.
 */
export interface IndexProposal {
  /** The record this came from, which is what makes the row stable. */
  ownerKind: UsageLink['ownerKind'];
  ownerId: string;
  /** The heading, in the record's own words. */
  term: string;
  /** The sub-heading, where the record has one of its own. */
  subTerm: string;
  /** Where it appears, in story order. */
  places: ProposedPlace[];
  /** What a press would do, or why it would do nothing. */
  says: string;
}

/** What each kind of owner is called where a screen has to group them. */
export const PROPOSAL_SOURCES: Record<UsageLink['ownerKind'], string> = {
  characterization: 'Characters',
  arc_point: 'Characters',
  theme: 'Themes',
  motif: 'Motifs',
  thread: 'Links',
};

// --------------------------------------------------------- naming a heading

interface Named {
  term: string;
  subTerm: string;
}

/**
 * What a record is called, as an index heading.
 *
 * **The record's own name, never a rearrangement of it.** Books invert a
 * person — *Crane, Silas* — and working that out from a string is guessing
 * where the surname is, which goes wrong on the first name that is not two
 * plain words. The heading arrives as the writer wrote it and
 * `renameHeading` is one press away, which is the same division the whole
 * module rests on: the program supplies the places and the writer supplies
 * the words.
 */
const nameOf = (file: ProjectFile, link: UsageLink): Named | null => {
  switch (link.ownerKind) {
    case 'characterization': {
      const item = file.characterizationItems.find((one) => (one.id as string) === link.ownerId);
      if (!item) return null;
      const person = workingCast(file).find((one) => (one.id as string) === (item.characterId as string));
      if (!person) return null;
      // The person is the heading and the trait is the sub-heading, which is
      // what a two-level index is for and is how a reader looks one up:
      // *Crane, Silas* and under it *miserliness*. The record already carries
      // both, so nothing is invented to get there.
      const trait = item.traitId
        ? file.characterTraits.find((one) => (one.id as string) === (item.traitId as string))
        : undefined;
      return { term: person.name, subTerm: trait?.name ?? '' };
    }
    case 'arc_point': {
      const point = file.arcPoints.find((one) => (one.id as string) === link.ownerId);
      if (!point) return null;
      const arc = file.characterArcs.find((one) => (one.id as string) === (point.arcId as string));
      const person = arc
        ? workingCast(file).find((one) => (one.id as string) === (arc.characterId as string))
        : undefined;
      if (!person) return null;
      return { term: person.name, subTerm: '' };
    }
    case 'theme': {
      const theme = onlyLiving(file.themes).find((one) => (one.id as string) === link.ownerId);
      return theme ? { term: theme.name, subTerm: '' } : null;
    }
    case 'motif': {
      const motif = onlyLiving(file.motifs).find((one) => (one.id as string) === link.ownerId);
      return motif ? { term: motif.name, subTerm: '' } : null;
    }
    case 'thread': {
      const thread = onlyLiving(file.threads).find((one) => (one.id as string) === link.ownerId);
      return thread ? { term: thread.name, subTerm: '' } : null;
    }
  }
};

// ------------------------------------------------------------- the proposals

/**
 * Every heading this book could carry, read off the anchors already in it.
 *
 * A record whose name has gone — buried in the graveyard, or deleted outright
 * — proposes nothing rather than proposing a heading with no words in it: an
 * index entry called nothing is worse than one absent, and the reading over
 * the writer's records asks each module's own function (addendum 24 §5j).
 */
export const indexProposals = (file: ProjectFile): IndexProposal[] => {
  const order = new Map(beatsInStoryOrder(file).map((beat, at) => [beat.id as string, at]));
  const marks = file.indexMarks ?? [];

  const groups = new Map<string, IndexProposal>();

  for (const link of file.usageLinks) {
    // Only an anchor that names a passage. A beat-wide pin means *somewhere in
    // this scene*, and an index entry has to point at a line.
    if (link.elementId === null) continue;
    const named = nameOf(file, link);
    if (!named || named.term.trim().length === 0) continue;

    const key = `${link.ownerKind}:${link.ownerId}`;
    const held =
      groups.get(key) ??
      ({
        ownerKind: link.ownerKind,
        ownerId: link.ownerId,
        term: named.term,
        subTerm: named.subTerm,
        places: [],
        says: '',
      } satisfies IndexProposal);

    const already = marks.some(
      (mark) =>
        (mark.elementId as string) === (link.elementId as string) &&
        sameHeading(mark.term, named.term) &&
        sameHeading(mark.subTerm, named.subTerm),
    );

    held.places.push({
      beatId: link.beatId,
      elementId: link.elementId,
      quote: link.quote,
      already,
    });
    groups.set(key, held);
  }

  const proposals = [...groups.values()];
  for (const one of proposals) {
    one.places.sort(
      (a, b) => (order.get(a.beatId as string) ?? 0) - (order.get(b.beatId as string) ?? 0),
    );
    one.says = describeProposal(one);
  }

  // Alphabetical, because that is the order the page they are going on is in,
  // and a list a writer is about to tick should read like what it will become.
  return proposals.sort(
    (a, b) =>
      a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }) ||
      a.subTerm.localeCompare(b.subTerm, undefined, { sensitivity: 'base' }),
  );
};

/** How many of a proposal's passages are not yet marked under its heading. */
export const newPlaces = (proposal: IndexProposal): ProposedPlace[] =>
  proposal.places.filter((place) => !place.already);

/**
 * What a press would do, said before it can be asked for.
 *
 * `trackRemoval`'s shape: the sentence a writer acts on, computed by the same
 * module that performs the act, so a screen cannot promise something the act
 * then refuses.
 *
 * **It does not name the heading**, which is the one thing driving the screen
 * changed about it. Written to stand alone it read *Index 2 passages under
 * Maeve Toller, Dutiful* on a row whose first words are *Maeve Toller,
 * Dutiful* — one answer said twice on one line, and the second copy is the one
 * that has to go. A row is a heading and a sentence about it, and the sentence
 * is about the **passages**.
 */
export const describeProposal = (proposal: IndexProposal): string => {
  const fresh = newPlaces(proposal).length;
  if (fresh === 0) return 'Already in the index.';
  const places = fresh === 1 ? 'one passage' : `${fresh} passages`;
  const standing = proposal.places.length - fresh;
  const kept =
    standing === 0
      ? ''
      : ` The ${standing === 1 ? 'one' : standing} already there ${standing === 1 ? 'is' : 'are'} left alone.`;
  return `Index ${places}.${kept}`;
};

/**
 * The whole list in one line, for the head of the panel.
 *
 * It names where the headings came from rather than only how many there are,
 * because *18 headings* invites the question this sentence exists to answer:
 * a writer who has never opened the index wants to know why the program
 * believes it knows what their book is about.
 */
export const describeProposals = (proposals: readonly IndexProposal[]): string => {
  if (proposals.length === 0) {
    return 'Nothing in this book is anchored to a passage yet. An index is built from the work you have already marked — a character moment, a theme, a motif, a moment on a story link — so anything you pin in the Character Creator or tag in the manuscript turns up here.';
  }
  const fresh = proposals.filter((one) => newPlaces(one).length > 0).length;
  const headings = proposals.length === 1 ? '1 heading' : `${proposals.length} headings`;
  if (fresh === 0) {
    return `${headings}, and every one of them is already in the index.`;
  }
  const done = proposals.length - fresh;
  const standing = done === 0 ? '' : ` ${done} of them ${done === 1 ? 'is' : 'are'} already in it.`;
  return `${headings} the book already carries, read off what you have marked elsewhere.${standing}`;
};

// --------------------------------------------------------------- the one act

/**
 * File one heading's passages into the index.
 *
 * **`markForIndex` does the work, once per passage**, which is what makes
 * *adds and never overwrites* true by construction rather than by a check
 * written here: that function has refused the same passage under the same
 * heading twice since the module was built (*marking it again is not a second
 * occurrence, it is the same writer doing the same thing twice*), so a second
 * press is a no-op and a passage somebody has already marked by hand is left
 * exactly as they left it — `principal` included, which is the one thing about
 * a mark only they can know.
 *
 * It returns how many were made, because a press that changes nothing must be
 * able to say so rather than looking identical to one that worked.
 */
export const acceptProposal = (
  file: ProjectFile,
  proposal: IndexProposal,
): { file: ProjectFile; made: number } => {
  let next = file;
  let made = 0;
  for (const place of proposal.places) {
    const before = (next.indexMarks ?? []).length;
    const { file: after } = markForIndex(next, {
      term: proposal.term,
      subTerm: proposal.subTerm,
      beatId: place.beatId,
      elementId: place.elementId,
      quote: place.quote,
    });
    next = after;
    if ((next.indexMarks ?? []).length > before) made += 1;
  }
  return { file: next, made };
};

/**
 * File every heading at once.
 *
 * Offered because the whole point is that a writer should not have to press a
 * button four hundred times, and the same argument applies at this level: a
 * book with forty headings is forty presses to do the thing they asked for.
 * It is the same act folded, so it refuses the same things and doubles
 * nothing.
 */
export const acceptAll = (
  file: ProjectFile,
  proposals: readonly IndexProposal[],
): { file: ProjectFile; made: number; headings: number } => {
  let next = file;
  let made = 0;
  let headings = 0;
  for (const proposal of proposals) {
    const out = acceptProposal(next, proposal);
    next = out.file;
    made += out.made;
    if (out.made > 0) headings += 1;
  }
  return { file: next, made, headings };
};

/** What `acceptAll` did, said afterwards. */
export const describeAccepted = (made: number, headings: number): string => {
  if (made === 0) return 'Nothing to add — every passage was already in the index.';
  const places = made === 1 ? '1 passage' : `${made} passages`;
  const under = headings === 1 ? '1 heading' : `${headings} headings`;
  return `${places} indexed, under ${under}.`;
};
