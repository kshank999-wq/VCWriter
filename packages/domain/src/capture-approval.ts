import { nowIso } from './entities/common.js';
import { captureKeyName, captureVocabulary } from './capture-vocabulary.js';
import { ref, type StoryEntityRef } from './entities/links.js';
import {
  addBeat,
  addCharacter,
  addResearchCategory,
  addResearchItem,
  linkEntities,
  DomainError,
} from './mutations.js';
import { researchCategoriesInOrder } from './selectors.js';
import { addResearchRow, outlinesOf } from './outline.js';
import { addBlock, addChild, boardsOf } from './sculptor.js';
import { knowsCharacter } from './characters.js';
import {
  CAPTURE_CATEGORIES,
  CAPTURE_CATEGORY_NAMES,
  type CaptureCategory,
  type CaptureItem,
} from './entities/capture.js';
import type { ProjectFile } from './project-file.js';
import type { ProjectFormat } from './entities/project.js';
import type {
  BoardId,
  CharacterId,
  OutlineId,
  OutlineItemId,
  ResearchCategoryId,
  SculptorNodeId,
  StructuralUnitId,
} from './ids.js';

/**
 * Turning captured material into project data (spec §9, §11).
 *
 * The rule that shapes this file: AI classification proposes, the writer
 * decides. Nothing here runs automatically — a capture becomes canonical only
 * when a person approves it, and the raw text is never cleared, so a wrong
 * approval can always be read back and redone.
 */

export type ApprovalDecision =
  | { kind: 'research'; categoryId: ResearchCategoryId; title?: string; body?: string }
  | { kind: 'beat'; unitId: StructuralUnitId; title?: string }
  /** A new person in the cast. */
  | { kind: 'character'; name?: string }
  /**
   * A note **about** somebody already in the cast (addendum 09 §4).
   *
   * Deliberately not the same decision as `character`, which makes one. A
   * writer dragging a mobile note onto Mara wants it filed against Mara, and a
   * second Mara is the one outcome that would be worse than doing nothing.
   *
   * What it becomes is a research note linked to them, which is where notes
   * about people already live — and not a characterization item, since whether
   * a thought about somebody *is* characterization is the Character Creator's
   * question and the writer's to answer (addendum 09 §3.2).
   */
  | { kind: 'about_character'; characterId: CharacterId; title?: string; body?: string }
  /**
   * Into the Outliner, at a place the writer chose (addendum 09 §15, from Ken:
   * *move them to outliners and Sculptor… you'd have to have the sculptor or
   * the outliner up and be able to drag it into a specific place*).
   *
   * **It files the note and then puts a row that references it**, which is two
   * things in one act for `captureFromScript`'s reason: something born on deck
   * in the room the writer is looking at is the one confusing outcome. The row
   * is a **reference** rather than a copy, which is `addResearchRow`'s own rule
   * (addendum 06 §5) — so the note is on the shelf and in the plan, once, and
   * editing it in either place is editing the note.
   */
  | {
      kind: 'outline';
      outlineId: OutlineId;
      parentId?: OutlineItemId | null;
      afterId?: OutlineItemId | null;
      beforeId?: OutlineItemId | null;
      /** Where the note is filed on the way past. Defaults to what it reads as. */
      categoryId?: ResearchCategoryId;
      title?: string;
      body?: string;
    }
  /**
   * Onto the Story Sculptor's board.
   *
   * **A card carries the words rather than a reference**, which is not an
   * inconsistency with the outline above but the board's own rule (addendum 03
   * §2): a board is a picture of possibilities, and a card is a claim somebody
   * made on it. The note is still filed, so nothing is lost if the card goes.
   */
  | {
      kind: 'board';
      boardId: BoardId;
      /** The card it hangs off, or null for a block of its own in the spine. */
      parentId?: SculptorNodeId | null;
      categoryId?: ResearchCategoryId;
      title?: string;
      body?: string;
    };

export interface RoutingSuggestion {
  decision: ApprovalDecision | null;
  /** What the interface should say about how sure this is. */
  confidence: number;
  reason: string;
}

const firstLine = (text: string): string => {
  const line = text.trim().split('\n')[0] ?? '';
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
};

/** A short title derived from the capture, when the writer does not supply one. */
export const captureTitle = (capture: CaptureItem): string => {
  const named = capture.inference?.entityName?.trim();
  if (named && named.length > 0) return named;
  const line = firstLine(capture.rawText);
  return line.length > 0 ? line : 'Untitled capture';
};

/**
 * The research folder a spoken category ordinarily reads as.
 *
 * Keyed by string since the vocabulary became the project's (addendum 09 §10):
 * a word this build has not heard of simply has no folder, which is what the
 * `if (!folder) return null` below already meant — no suggestion, and the
 * writer places it. **The structural two deliberately have none**: a note said
 * against a scene or a chapter is about the manuscript, and the one thing this
 * module may never do is file into it. **`scene` is the same answer** — it is
 * offered where the format has not taken the word, and it means the same kind
 * of thing the unit does.
 */
const FOLDER_FOR: Record<string, string | undefined> = {
  character: 'characters',
  plot_point: 'plot_points',
  idea: 'ideas',
  theme: 'themes',
  setting: 'locations',
  research: 'notes',
  // `arc` has no folder of its own and is not getting one: an arc note with
  // nobody named is a general thought, and Ideas is where those go.
  arc: 'ideas',
  /**
   * A remembered line is an observation, and Notes is where an observation
   * goes. **Deliberately not Characters even where a name was said**: a note
   * filed under somebody is a claim about them, and a line half-heard on a
   * walk is not one yet — the desktop places it, which is the whole rule.
   */
  dialogue: 'notes',
};

// ------------------------------------------------- the groups they spoke (§12)

/** Two spellings of one folder name. Speech is loose, so matching is. */
const plainly = (name: string): string =>
  name.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');

/**
 * The folder of that name already sitting under `parentId`, or undefined.
 *
 * The **living** categories only, so a folder in the graveyard does not make a
 * spoken group look placed — addendum 24 §5l's edge, where a reading over the
 * writer's own records asks the module's one function.
 */
const childNamed = (file: ProjectFile, parentId: ResearchCategoryId, name: string) =>
  researchCategoriesInOrder(file).find(
    (one) => (one.parentId ?? null) === parentId && plainly(one.name) === plainly(name),
  );

/**
 * The folder a note is filed in when the writer named none.
 *
 * **One reading**, asked by every act that has to file a note on its way
 * somewhere else — the two plans below, and anything built after them. It
 * prefers what the writer chose, then what the note's own category reads as,
 * then the general Notes shelf a book has, then **Ideas** — which is where a
 * general thought goes, and is `arc`'s own answer below — and only then
 * whatever folder there is. A note with nowhere to go is the one outcome that
 * loses somebody's words, and *Characters* is the wrong place to lose it: a
 * screenplay has no Notes shelf, so the first folder there is the cast.
 */
export const filingFolder = (
  file: ProjectFile,
  capture: CaptureItem,
  chosen: ResearchCategoryId | null,
): ResearchCategoryId | null => {
  const folders = researchCategoriesInOrder(file);
  if (chosen && folders.some((one) => one.id === chosen)) return chosen;
  const key = capture.category ? FOLDER_FOR[capture.category] : undefined;
  const byCategory = key ? folders.find((one) => one.systemKey === key) : undefined;
  const general =
    folders.find((one) => one.systemKey === 'notes') ?? folders.find((one) => one.systemKey === 'ideas');
  return (byCategory ?? general ?? folders[0])?.id ?? null;
};

/** The folder a spoken category reads as, which is where a group nests. */
const folderForCategory = (file: ProjectFile, category: string | null) => {
  const key = category ? FOLDER_FOR[category] : undefined;
  return key ? researchCategoriesInOrder(file).find((one) => one.systemKey === key) : undefined;
};

/**
 * What filing a whole spoken group would do, before it can be asked for
 * (§12) — `trackRemoval`'s shape: a refusal a writer can act on, or the
 * sentence that says what a press is about to change.
 *
 * **This is the one place the taxonomy grows**, and it grows at the desk by a
 * deliberate press. The phone said a word; nothing was made by saying it.
 */
export interface GroupOffer {
  /** Null where the press cannot be made; `why` says so. */
  parentId: ResearchCategoryId | null;
  /** The folder that already holds this group, where there is one. */
  existingId: ResearchCategoryId | null;
  count: number;
  /** What the button should say, or the reason there is no button. */
  why: string;
}

export const groupOffer = (
  file: ProjectFile,
  captures: readonly CaptureItem[],
  category: string | null,
  group: string,
): GroupOffer => {
  const waiting = captures.filter(
    (one) =>
      (one.status === 'pending' || one.status === 'needs_review') &&
      one.category === category &&
      plainly(one.subcategory ?? '') === plainly(group),
  );
  const folder = folderForCategory(file, category);
  if (!folder) {
    // The structural two have no folder on purpose: a note said against a scene
    // is about the manuscript, and this module may never file into it.
    return {
      parentId: null,
      existingId: null,
      count: waiting.length,
      why: `${captureKeyName(category ?? '', null)} notes have no folder — place these by hand`,
    };
  }
  if (waiting.length === 0) {
    return { parentId: folder.id, existingId: null, count: 0, why: 'Nothing waiting in that group' };
  }
  const existing = childNamed(file, folder.id, group);
  const notes = waiting.length === 1 ? '1 note' : `${waiting.length} notes`;
  return {
    parentId: folder.id,
    existingId: existing?.id ?? null,
    count: waiting.length,
    why: existing
      ? `File ${notes} into ${existing.name}, under ${folder.name}`
      : `Make ${group} under ${folder.name} and file ${notes} into it`,
  };
};

/**
 * Make the folder a spoken group names, if it is not there already.
 *
 * Returns the file and the folder to file into, so the caller can then put each
 * note through `approveCapture` exactly as a single press does — **one act with
 * a destination and not a second kind of approval**, which is what keeps a
 * whole group and one note indistinguishable once they are filed.
 */
export const openGroupFolder = (
  file: ProjectFile,
  category: string | null,
  group: string,
): { file: ProjectFile; categoryId: ResearchCategoryId } => {
  const folder = folderForCategory(file, category);
  if (!folder) throw new DomainError('There is nowhere to file that group');
  const existing = childNamed(file, folder.id, group);
  if (existing) return { file, categoryId: existing.id };
  const made = addResearchCategory(file, { name: group.trim(), parentId: folder.id });
  return { file: made.file, categoryId: made.category.id };
};

/**
 * What the category the writer spoke reads as, if they spoke one.
 *
 * **Two of the five point at a person.** A Character or an Arc note that names
 * somebody already in the cast is about *them*, which is mechanical rather than
 * a guess — the name was said, and either it matches the cast list or it does
 * not. A Character note naming somebody new offers to make them; every other
 * case is a folder.
 */
const spokenSuggestion = (file: ProjectFile, capture: CaptureItem): RoutingSuggestion | null => {
  const category = capture.category;
  if (!category) return null;
  const name = capture.subjectName?.trim() ?? '';
  const said = capture.subcategory?.trim();

  if (name.length > 0 && (category === 'character' || category === 'arc')) {
    /**
     * **A group narrows a folder; it cannot narrow a person** (§12).
     *
     * Driving the walk found the one case where the two things a writer said
     * pull apart: *dictate group casting* and then *character, Tom*. The name
     * is the more specific of the two and it is what these branches are for —
     * a note about somebody goes to them, and a person nobody has recorded is
     * offered as one. So the person wins, and **the group is said in the
     * reason** rather than dropped where nobody can see it: a writer who hears
     * their own word back knows it was heard, and the drag is still there for
     * filing it the other way.
     */
    const aside = said ? ` · you also said ${said}, which does not narrow a person` : '';
    const known = knowsCharacter(file, name);
    if (known) {
      return {
        decision: { kind: 'about_character', characterId: known.id },
        confidence: 1,
        reason: `You said ${captureKeyName(category, file.project.format as ProjectFormat)} — ${known.name}, who is already in the cast${aside}`,
      };
    }
    if (category === 'character') {
      return {
        decision: { kind: 'character', name },
        confidence: 1,
        reason: `You said Character — ${name}, who is not in the cast yet${aside}`,
      };
    }
  }

  /**
   * **The format's own word**, which this function had been asking `null` for
   * since §10 widened the vocabulary — so a note said as *scene* read back as
   * *Scene or chapter* on a screenplay that has scenes. The project knows what
   * it is; nothing here had asked it.
   */
  const words = (one: string): string => captureKeyName(one, file.project.format as ProjectFormat);

  const key = FOLDER_FOR[category];
  const folder = key
    ? researchCategoriesInOrder(file).find((candidate) => candidate.systemKey === key)
    : undefined;

  /**
   * A category with no folder of its own here, which is two cases and one
   * answer.
   *
   * **The structural words and `scene` have none on purpose** — a note said
   * against a scene is about the manuscript, and the one thing this module may
   * never do is file into it — and **a mapped folder can simply be absent**,
   * since a screenplay has no General Notes shelf for a line of dialogue to go
   * on. Driving it found what falling through cost: the suggestion read *No
   * category identified*, said to somebody who had just identified one out
   * loud. It goes where a general thought goes, and the sentence says both that
   * they were heard and that nobody has decided where it belongs.
   */
  if (!folder) {
    const general = filingFolder(file, capture, null);
    const where = researchCategoriesInOrder(file).find((one) => one.id === general);
    return general && where
      ? {
          decision: { kind: 'research', categoryId: general },
          // Deliberately short of certainty: this is where it waits rather than
          // where it belongs, and `needsReview` reads this number.
          confidence: 0.5,
          reason: `You said ${words(category)} — no folder for that, so ${where.name} unless you place it yourself`,
        }
      : null;
  }

  /**
   * A group the writer said on the phone (§12), which narrows the folder
   * without replacing it. **It routes there only if the folder is already
   * there**: making one is an act somebody presses, not something a suggestion
   * does behind them — so where it is absent the note goes to the category's
   * own folder and the reason says the word, which is how a writer knows it was
   * not lost.
   */
  const group = said;
  if (group) {
    const under = childNamed(file, folder.id, group);
    return under
      ? {
          decision: { kind: 'research', categoryId: under.id },
          confidence: 1,
          reason: `You said ${words(category)}, ${group} — which is already under ${folder.name}`,
        }
      : {
          decision: { kind: 'research', categoryId: folder.id },
          confidence: 1,
          reason: `You said ${words(category)}, ${group} — no ${group} folder yet`,
        };
  }

  return {
    decision: { kind: 'research', categoryId: folder.id },
    confidence: 1,
    reason:
      category === 'arc'
        ? 'An arc note with nobody named — Ideas until you say otherwise'
        : `You said ${words(category)}`,
  };
};

/**
 * Where this capture probably belongs. Only a proposal: the caller shows it,
 * the writer confirms or changes it.
 */
export const suggestRouting = (file: ProjectFile, capture: CaptureItem): RoutingSuggestion => {
  const inference = capture.inference;
  const categories = researchCategoriesInOrder(file);

  // A destination the writer chose on the capture device is a decision, not a
  // guess. It outranks whatever the classifier proposed.
  const requested = capture.requestedRouting;
  if (requested) {
    if (requested.kind === 'character') {
      return {
        decision: { kind: 'character', name: inference?.entityName ?? captureTitle(capture) },
        confidence: 1,
        reason: 'You chose Characters when you captured this',
      };
    }
    if (requested.kind === 'research') {
      const category = requested.categoryKey
        ? categories.find((candidate) => candidate.systemKey === requested.categoryKey)
        : undefined;
      if (category) {
        return {
          decision: { kind: 'research', categoryId: category.id },
          confidence: 1,
          reason: `You chose ${category.name} when you captured this`,
        };
      }
    }
  }

  // What the writer said out loud on the phone. Below a destination they
  // actually chose, above anything a classifier guessed — it is testimony, and
  // the whole of §2 is that it says *what kind of thought this is* rather than
  // where it goes, so what follows is the ordinary reading of each kind and
  // never more than a proposal.
  const spoken = spokenSuggestion(file, capture);
  if (spoken) return spoken;

  if (inference?.categoryKey === 'characters') {
    return {
      decision: { kind: 'character', name: inference.entityName ?? captureTitle(capture) },
      confidence: inference.confidence,
      reason: inference.entityName
        ? `Named a character: ${inference.entityName}`
        : 'Routed to Characters',
    };
  }

  if (inference?.categoryKey) {
    const category = categories.find((candidate) => candidate.systemKey === inference.categoryKey);
    if (category) {
      return {
        decision: { kind: 'research', categoryId: category.id },
        confidence: inference.confidence,
        reason: `Routed to ${category.name}`,
      };
    }
  }

  const ideas = categories.find((category) => category.systemKey === 'ideas') ?? categories[0];
  return {
    decision: ideas ? { kind: 'research', categoryId: ideas.id } : null,
    confidence: inference?.confidence ?? 0,
    reason: ideas ? `No category identified — defaulting to ${ideas.name}` : 'No research categories yet',
  };
};

/** Captures the writer should look at before anything is created from them. */
export const needsReview = (capture: CaptureItem, confidenceFloor = 0.7): boolean =>
  capture.status === 'needs_review' ||
  (capture.status === 'pending' && (capture.inference?.confidence ?? 0) < confidenceFloor);

export interface ApprovalResult {
  file: ProjectFile;
  capture: CaptureItem;
  resultRef: StoryEntityRef;
}

/**
 * Create the project entity a capture becomes, and mark the capture approved.
 * The capture row keeps its raw text and audio reference either way.
 */
export const approveCapture = (
  file: ProjectFile,
  capture: CaptureItem,
  decision: ApprovalDecision,
): ApprovalResult => {
  if (capture.status === 'approved') {
    throw new DomainError('This capture has already been approved');
  }

  const reviewedAt = nowIso();
  let next = file;
  let resultRef: StoryEntityRef;

  if (decision.kind === 'research') {
    next = addResearchItem(file, {
      categoryId: decision.categoryId,
      title: decision.title ?? captureTitle(capture),
      // **The writer's words where they changed them, the phone's where they
      // did not.** The note itself is never rewritten — `raw_text` is the
      // recovery record (§9) — so this is the difference between correcting
      // what goes into the project and editing the testimony behind it.
      body: decision.body ?? capture.rawText,
      origin: 'mobile_capture',
    });
    const created = next.researchItems[next.researchItems.length - 1];
    if (!created) throw new DomainError('The research note could not be created');
    resultRef = ref('research_item', created.id);
  } else if (decision.kind === 'beat') {
    const added = addBeat(file, {
      unitId: decision.unitId,
      title: decision.title ?? captureTitle(capture),
      summary: capture.rawText,
    });
    next = added.file;
    resultRef = ref('beat', added.beat.id);
  } else if (decision.kind === 'about_character') {
    const person = file.characters.find((one) => (one.id as string) === (decision.characterId as string));
    if (!person) throw new DomainError('That character is not in the project');

    // Filed where notes about people already live, and linked to them, so it
    // turns up in their Related Elements without the Creator being involved.
    const folder =
      researchCategoriesInOrder(file).find((category) => category.systemKey === 'characters') ??
      researchCategoriesInOrder(file)[0];
    if (!folder) throw new DomainError('There is nowhere to file this note');

    next = addResearchItem(file, {
      categoryId: folder.id,
      title: decision.title ?? captureTitle(capture),
      body: decision.body ?? capture.rawText,
      origin: 'mobile_capture',
    });
    const created = next.researchItems[next.researchItems.length - 1];
    if (!created) throw new DomainError('The research note could not be created');
    next = linkEntities(next, { from: ref('research_item', created.id), to: ref('character', person.id) });
    resultRef = ref('research_item', created.id);
  } else if (decision.kind === 'outline' || decision.kind === 'board') {
    /**
     * Into a plan, which is **two things in one act**.
     *
     * The note is filed first — it is a thought somebody had, and it belongs on
     * the shelf whatever happens to the plan — and then it is placed. If the
     * placing fails there is nothing to show for it, so **nothing is kept**:
     * `captureFromScript`'s rule, since a note filed into a folder while the
     * writer was watching a board is the one confusing outcome.
     */
    const folder = filingFolder(file, capture, decision.categoryId ?? null);
    if (!folder) throw new DomainError('There is nowhere to file this note');

    next = addResearchItem(file, {
      categoryId: folder,
      title: decision.title ?? captureTitle(capture),
      body: decision.body ?? capture.rawText,
      origin: 'mobile_capture',
    });
    const item = next.researchItems[next.researchItems.length - 1];
    if (!item) throw new DomainError('The research note could not be created');

    if (decision.kind === 'outline') {
      // A **reference**, never a copy (addendum 06 §5): the row reads the note's
      // name through to the shelf, so renaming it renames both.
      const put = addResearchRow(next, decision.outlineId, item.id, {
        parentId: decision.parentId ?? null,
        afterId: decision.afterId ?? null,
        beforeId: decision.beforeId ?? null,
      });
      if (!put.itemId) throw new DomainError('That note could not be placed in the outline');
      next = put.file;
    } else {
      // The board holds no reference, so a card carries the words (addendum 03
      // §2). The note is still on the shelf, so nothing is lost if the card is.
      const made =
        decision.parentId
          ? addChild(next, decision.boardId, decision.parentId, { title: item.title })
          : addBlock(next, decision.boardId, { title: item.title });
      if (!made.nodeId) throw new DomainError('That note could not be placed on the board');
      next = made.file;
    }

    resultRef = ref('research_item', item.id);
  } else {
    next = addCharacter(file, {
      name: decision.name ?? captureTitle(capture),
      description: capture.rawText,
    });
    const created = next.characters[next.characters.length - 1];
    if (!created) throw new DomainError('The character could not be created');
    resultRef = ref('character', created.id);
  }

  return {
    file: next,
    capture: { ...capture, status: 'approved', reviewedAt, resultRef },
    resultRef,
  };
};

/**
 * What dropping a note into a plan would do, said before it can be asked for.
 *
 * `trackRemoval`'s shape: the sentence or the refusal, in one place, so the
 * shelf, the right-click menu and the drop cannot promise different things.
 * The refusal is the useful half — a room with no board or no outline yet is
 * the commonest reason a drag does nothing, and *nothing happened* is the one
 * answer a writer cannot act on.
 */
export interface NoteOffer {
  can: boolean;
  /** What the control should be called. */
  act: string;
  /** What a press or a drop would do, or why it cannot. */
  says: string;
}

export const noteOffer = (
  file: ProjectFile,
  capture: CaptureItem,
  into: 'outline' | 'board',
): NoteOffer => {
  const name = captureTitle(capture);
  const folder = filingFolder(file, capture, null);
  if (!folder) {
    return { can: false, act: 'File it', says: 'There is nowhere to file this note yet.' };
  }
  const where = researchCategoriesInOrder(file).find((one) => one.id === folder);
  if (into === 'outline') {
    const outline = outlinesOf(file)[0];
    return outline
      ? {
          can: true,
          act: 'To the Outliner',
          says: `“${name}” is filed under ${where?.name ?? 'Notes'} and a row that reads it joins the outline.`,
        }
      : { can: false, act: 'To the Outliner', says: 'There is no outline yet to put it in.' };
  }
  const board = boardsOf(file)[0];
  return board
    ? {
        can: true,
        act: 'To the Story Sculptor',
        says: `“${name}” is filed under ${where?.name ?? 'Notes'} and a card carrying its words joins the board.`,
      }
    : { can: false, act: 'To the Story Sculptor', says: 'There is no board yet to put it on.' };
};

/** Rejection keeps the capture and its raw text; only its status changes. */
export const rejectCapture = (capture: CaptureItem): CaptureItem => ({
  ...capture,
  status: 'rejected',
  reviewedAt: nowIso(),
});

/** Send an uncertain capture back to the queue for a decision later. */
export const deferCapture = (capture: CaptureItem): CaptureItem => ({
  ...capture,
  status: 'needs_review',
});

// ------------------------------------------------- the Mobile App inbox

/**
 * One group of the desktop Mobile App inbox (addendum 09 §4, stage 1).
 *
 * The five categories in the order the app offers them, plus whatever named no
 * category — old captures, and anything typed rather than spoken. **The last
 * group is never hidden**: an inbox that quietly dropped notes it could not
 * file would be an inbox nobody can trust.
 */
export interface InboxGroup {
  category: string | null;
  name: string;
  captures: CaptureItem[];
  /**
   * The same notes divided by the group they were said under (§12).
   *
   * **Empty where there is nothing to divide by**, which is the glossary
   * letters' rule (addendum 20 §17a): a single heading reading *No group* over
   * everything in a category is a division that divides nothing. `captures`
   * above stays the whole category either way, so a surface that has never
   * heard of groups reads exactly as it did.
   */
  under: InboxSubgroup[];
}

/** One spoken group within a category's notes. */
export interface InboxSubgroup {
  /** Null for the notes said under no group, which sort last. */
  group: string | null;
  name: string;
  captures: CaptureItem[];
}

/**
 * The project's captures, grouped by what the writer said they were, newest
 * first inside each group.
 *
 * Approved and rejected captures are left out: this is the tray of what is
 * still waiting to be placed, and a decision already made is not waiting. The
 * rows themselves are never deleted, so nothing here is destructive.
 */
export const inboxGroups = (
  captures: readonly CaptureItem[],
  /**
   * The project's format, where the caller knows it, so the structural groups
   * are named in its own words — *Scene* on a screenplay, *Chapter* in a novel.
   * Without one they are named loosely rather than not at all.
   */
  format: ProjectFormat | null = null,
): InboxGroup[] => {
  const waiting = [...captures]
    .filter((one) => one.status === 'pending' || one.status === 'needs_review')
    .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));

  /**
   * **Grouped by what is there rather than by a list written here** (addendum
   * 09 §10). The five were an enum and this reading walked them; the
   * vocabulary is the project's now, so a list in this file would be a second
   * one — and a note captured under a word it did not have would have fallen
   * through both the walk and the `=== null` at the end, which is the one
   * thing the comment above says cannot happen.
   */
  const order = format ? captureVocabulary(format).map((one) => one.key) : [...CAPTURE_CATEGORIES];
  const seen = [...new Set(waiting.map((one) => one.category).filter((one): one is string => one !== null))];
  const known = order.filter((key) => seen.includes(key));
  const rest = seen.filter((key) => !order.includes(key as never)).sort();

  const groups: InboxGroup[] = [...known, ...rest]
    .map((key) => {
      const captures = waiting.filter((one) => one.category === key);
      return { category: key, name: captureKeyName(key, format), captures, under: divide(captures) };
    })
    .filter((group) => group.captures.length > 0);

  const uncategorised = waiting.filter((one) => one.category === null);
  if (uncategorised.length > 0) {
    groups.push({
      category: null,
      name: 'No category',
      captures: uncategorised,
      under: divide(uncategorised),
    });
  }
  return groups;
};

/**
 * One category's notes by the group they were said under.
 *
 * **In the order the notes themselves are in**, which this list has kept newest
 * first since it was built — so the group somebody was last talking about heads
 * the category, which is also the one they came to the desk about. Writing
 * *first said first* here would have been a second ordering inside a list that
 * already has one, and the test caught it.
 *
 * **Nothing at all where no note names one** — see `InboxGroup.under`. One
 * spelling wins per group for `groupsSaid`' reason on the phone: the desk
 * should not draw two headings out of *marketing* and *Marketing*.
 */
const divide = (captures: readonly CaptureItem[]): InboxSubgroup[] => {
  const named: { name: string; captures: CaptureItem[] }[] = [];
  const loose: CaptureItem[] = [];
  for (const one of captures) {
    const group = one.subcategory?.trim();
    if (!group) {
      loose.push(one);
      continue;
    }
    const found = named.find((candidate) => plainly(candidate.name) === plainly(group));
    if (found) found.captures.push(one);
    else named.push({ name: group, captures: [one] });
  }
  if (named.length === 0) return [];
  const out: InboxSubgroup[] = named.map((one) => ({
    group: one.name,
    name: one.name,
    captures: one.captures,
  }));
  // Last, because a note nobody grouped has no place among the ones somebody
  // did — `arcBoard`'s split, and the graveyard's orphans.
  if (loose.length > 0) out.push({ group: null, name: 'No group', captures: loose });
  return out;
};
