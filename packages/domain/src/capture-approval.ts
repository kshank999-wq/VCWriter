import { nowIso } from './entities/common.js';
import { ref, type StoryEntityRef } from './entities/links.js';
import { addBeat, addCharacter, addResearchItem, linkEntities, DomainError } from './mutations.js';
import { researchCategoriesInOrder } from './selectors.js';
import { knowsCharacter } from './characters.js';
import {
  CAPTURE_CATEGORIES,
  CAPTURE_CATEGORY_NAMES,
  type CaptureCategory,
  type CaptureItem,
} from './entities/capture.js';
import type { ProjectFile } from './project-file.js';
import type { CharacterId, ResearchCategoryId, StructuralUnitId } from './ids.js';

/**
 * Turning captured material into project data (spec §9, §11).
 *
 * The rule that shapes this file: AI classification proposes, the writer
 * decides. Nothing here runs automatically — a capture becomes canonical only
 * when a person approves it, and the raw text is never cleared, so a wrong
 * approval can always be read back and redone.
 */

export type ApprovalDecision =
  | { kind: 'research'; categoryId: ResearchCategoryId; title?: string }
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
  | { kind: 'about_character'; characterId: CharacterId; title?: string };

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

/** The research folder a spoken category ordinarily reads as. */
const FOLDER_FOR: Partial<Record<CaptureCategory, string>> = {
  character: 'characters',
  plot_point: 'plot_points',
  idea: 'ideas',
  theme: 'themes',
  // `arc` has no folder of its own and is not getting one: an arc note with
  // nobody named is a general thought, and Ideas is where those go.
  arc: 'ideas',
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

  if (name.length > 0 && (category === 'character' || category === 'arc')) {
    const known = knowsCharacter(file, name);
    if (known) {
      return {
        decision: { kind: 'about_character', characterId: known.id },
        confidence: 1,
        reason: `You said ${CAPTURE_CATEGORY_NAMES[category]} — ${known.name}, who is already in the cast`,
      };
    }
    if (category === 'character') {
      return {
        decision: { kind: 'character', name },
        confidence: 1,
        reason: `You said Character — ${name}, who is not in the cast yet`,
      };
    }
  }

  const key = FOLDER_FOR[category];
  const folder = key
    ? researchCategoriesInOrder(file).find((candidate) => candidate.systemKey === key)
    : undefined;
  if (!folder) return null;

  return {
    decision: { kind: 'research', categoryId: folder.id },
    confidence: 1,
    reason:
      category === 'arc'
        ? 'An arc note with nobody named — Ideas until you say otherwise'
        : `You said ${CAPTURE_CATEGORY_NAMES[category]}`,
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
      body: capture.rawText,
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
      body: capture.rawText,
      origin: 'mobile_capture',
    });
    const created = next.researchItems[next.researchItems.length - 1];
    if (!created) throw new DomainError('The research note could not be created');
    next = linkEntities(next, { from: ref('research_item', created.id), to: ref('character', person.id) });
    resultRef = ref('research_item', created.id);
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
  category: CaptureCategory | null;
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
export const inboxGroups = (captures: readonly CaptureItem[]): InboxGroup[] => {
  const waiting = [...captures]
    .filter((one) => one.status === 'pending' || one.status === 'needs_review')
    .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));

  const groups: InboxGroup[] = CAPTURE_CATEGORIES.map((category) => ({
    category,
    name: CAPTURE_CATEGORY_NAMES[category],
    captures: waiting.filter((one) => one.category === category),
  })).filter((group) => group.captures.length > 0);

  const uncategorised = waiting.filter((one) => one.category === null);
  if (uncategorised.length > 0) {
    groups.push({ category: null, name: 'No category', captures: uncategorised });
  }
  return groups;
};
