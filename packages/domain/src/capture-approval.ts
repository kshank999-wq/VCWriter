import { nowIso } from './entities/common.js';
import { ref, type StoryEntityRef } from './entities/links.js';
import { addBeat, addCharacter, addResearchItem, DomainError } from './mutations.js';
import { researchCategoriesInOrder } from './selectors.js';
import type { CaptureItem } from './entities/capture.js';
import type { ProjectFile } from './project-file.js';
import type { ResearchCategoryId, StructuralUnitId } from './ids.js';

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
  | { kind: 'character'; name?: string };

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
