import { elementsOf, findResource, findState } from './narrative.js';
import { conditionsIn } from './narrative.js';
import { meets, meetsGroup, reachable, sayCondition } from './narrative-eval.js';
import type { Condition, EndingContributor, NarrativeElement } from './entities/narrative.js';
import type { PlayState, Reason } from './narrative-eval.js';
import type { ProjectFile } from './project-file.js';

/**
 * Interactive Narrative: endings and the outcome matrix (addendum 18, stage 8
 * — §11).
 *
 * The audit a seventh time, and this one inside the module's own spec. §7's
 * entity table called an `EndingDefinition` **new**; it is not. An ending is a
 * node whose kind says so, its **hard requirements are its conditions**, and
 * stages 2, 3 and 5 already evaluate them, check them and edit them. What was
 * genuinely missing is one half of one sentence of §11: the *weighted
 * contributors*.
 *
 * And a weight is not a condition, which is the decision the stage rests on.
 * **A condition group is boolean and a weight is not**: a group answers *may
 * this happen*, a contributor answers *how much of this has been earned*, and
 * summing booleans is not a thing a `ConditionGroup` can be asked to do. So the
 * two are kept apart all the way down — `conditions` gates and `contributors`
 * score, one vetoes and the other only ranks, and no function here takes
 * *whatever decides an ending* and works out which it was.
 *
 * Everything below is a reading. **Nothing decides an ending except the state
 * the player is holding**, computed when asked, so moving a weight changes
 * which ending is earned with nothing run.
 */

// ------------------------------------------------------------- what an ending is

/** A node that finishes the game. Kind or flag: the designer means both. */
export const isEnding = (element: NarrativeElement): boolean =>
  element.kind === 'ending' || element.endsHere;

export const endingsOf = (file: ProjectFile): NarrativeElement[] => elementsOf(file).filter(isEnding);

/**
 * Whether an ending is scored, **read rather than declared**.
 *
 * An ending with contributors is a score; one without is deterministic. There
 * is no switch, so there is no way for the switch and the rules to disagree —
 * which is the same absence the whole module rests on.
 */
export const isScored = (ending: NarrativeElement): boolean => ending.contributors.length > 0;

// ----------------------------------------------------------------- the score

export interface ContributorReading {
  contributor: EndingContributor;
  /** True where the player currently satisfies it. */
  met: boolean;
  says: string;
}

export interface EndingStanding {
  ending: NarrativeElement;
  /** Whether the hard requirements are satisfied. A veto, never a score. */
  allowed: boolean;
  /** Why not, in sentences. Empty where it is allowed. */
  blockedBy: Reason[];
  scored: boolean;
  /** The sum of the weights whose conditions hold. Zero where unscored. */
  score: number;
  /** What it could reach if everything held — for the *how close* reading. */
  most: number;
  threshold: number;
  /** Allowed, and at or past the threshold where it is scored. */
  earned: boolean;
  contributors: ContributorReading[];
}

/** One ending against the state the player is holding. */
export const endingStanding = (file: ProjectFile, state: PlayState, ending: NarrativeElement): EndingStanding => {
  const gate = meetsGroup(file, state, ending.conditions);
  const readings = ending.contributors.map((contributor) => ({
    contributor,
    met: meets(file, state, contributor.condition),
    says: sayCondition(file, contributor.condition),
  }));
  const score = readings.filter((one) => one.met).reduce((sum, one) => sum + one.contributor.weight, 0);
  // Only what counts *for* it: a negative weight cannot be "reached", and
  // counting it in the best case would make the bar move as the player loses.
  const most = ending.contributors.filter((one) => one.weight > 0).reduce((sum, one) => sum + one.weight, 0);
  const scored = isScored(ending);

  return {
    ending,
    allowed: gate.ok,
    blockedBy: gate.failing,
    scored,
    score: scored ? score : 0,
    most,
    threshold: ending.threshold,
    earned: gate.ok && (!scored || score >= ending.threshold),
    contributors: readings,
  };
};

/**
 * Every ending, ranked.
 *
 * **Earned first, then by score, then by the designer's own order.** The last
 * of those is what makes it deterministic where two endings tie — and the tie
 * is *said* rather than quietly broken, because an ending chosen by an
 * accident of ordering is the kind of thing a designer finds out from a player.
 */
export const endingBoard = (file: ProjectFile, state: PlayState): EndingStanding[] => {
  const order = new Map(endingsOf(file).map((one, index) => [one.id as string, index]));
  return endingsOf(file)
    .map((one) => endingStanding(file, state, one))
    .sort((a, b) => {
      if (a.earned !== b.earned) return a.earned ? -1 : 1;
      if (a.score !== b.score) return b.score - a.score;
      return (order.get(a.ending.id as string) ?? 0) - (order.get(b.ending.id as string) ?? 0);
    });
};

/**
 * The ending this state earns, and whether anything tied with it.
 *
 * It picks, because a game has to; and it says when the pick was a tie,
 * because **a tie broken silently is the one a designer hears about from a
 * player**. Where nothing is earned it says so rather than reaching for the
 * nearest: no ending is a real outcome and usually means a requirement nobody
 * can meet.
 */
export const earnedEnding = (
  file: ProjectFile,
  state: PlayState,
): { ending: NarrativeElement | null; tiedWith: NarrativeElement[] } => {
  const board = endingBoard(file, state).filter((one) => one.earned);
  const best = board[0];
  if (!best) return { ending: null, tiedWith: [] };
  return {
    ending: best.ending,
    tiedWith: board.slice(1).filter((one) => one.score === best.score).map((one) => one.ending),
  };
};

/** What an ending's standing says, in a sentence. */
export const describeEnding = (standing: EndingStanding): string => {
  if (!standing.allowed) {
    return `Not possible here: ${standing.blockedBy.map((one) => one.says).join('; ')}.`;
  }
  if (!standing.scored) return 'Earned — nothing else is required.';
  return standing.earned
    ? `Earned with ${standing.score} of ${standing.threshold} needed.`
    : `${standing.score} of ${standing.threshold} needed${standing.most < standing.threshold ? ', and only ' + standing.most + ' is reachable at all' : ''}.`;
};

// ---------------------------------------------------------------- the matrix

export interface MatrixCell {
  /** Required by this ending's own gate, weighted by it, or neither. */
  requires: Condition | null;
  contributes: EndingContributor | null;
}

export interface MatrixRow {
  /** The state's key or the resource's name. */
  subject: string;
  subjectId: string;
  kind: 'state' | 'resource';
  /** One per ending, in the same order as `endings`. */
  cells: MatrixCell[];
}

export interface OutcomeMatrix {
  endings: NarrativeElement[];
  rows: MatrixRow[];
}

/**
 * §11's Ending Matrix: what contributes to each ending, side by side.
 *
 * **Read off the rules and never typed.** Every row is a state or a resource
 * some ending mentions — so an ending that stops asking about the keycard
 * loses its column entry with nothing run, and a row that nothing mentions is
 * absent rather than empty.
 *
 * Requirements and weights sit in the same cell and stay distinguishable, which
 * is §11's own sentence: a designer reading down a column must be able to tell
 * *this one is impossible without it* from *this one counts for twenty*.
 */
export const outcomeMatrix = (file: ProjectFile): OutcomeMatrix => {
  const endings = endingsOf(file);

  const subjects = new Map<string, { subject: string; kind: 'state' | 'resource' }>();
  const note = (condition: Condition): void => {
    if (subjects.has(condition.subjectId)) return;
    const name =
      condition.subject === 'state'
        ? findState(file, condition.subjectId as never)?.key
        : findResource(file, condition.subjectId as never)?.name;
    subjects.set(condition.subjectId, {
      subject: name || (condition.subject === 'state' ? 'a state that has gone' : 'a resource that has gone'),
      kind: condition.subject,
    });
  };
  for (const ending of endings) {
    for (const condition of conditionsIn(ending.conditions)) note(condition);
    for (const contributor of ending.contributors) note(contributor.condition);
  }

  const rows: MatrixRow[] = [...subjects.entries()].map(([subjectId, about]) => ({
    subject: about.subject,
    subjectId,
    kind: about.kind,
    cells: endings.map((ending) => ({
      requires: conditionsIn(ending.conditions).find((one) => one.subjectId === subjectId) ?? null,
      contributes: ending.contributors.find((one) => one.condition.subjectId === subjectId) ?? null,
    })),
  }));

  return { endings, rows };
};

/** What one cell says, for the matrix's text. */
export const describeCell = (file: ProjectFile, cell: MatrixCell): string => {
  const parts: string[] = [];
  if (cell.requires) parts.push(`needs ${sayCondition(file, cell.requires)}`);
  if (cell.contributes) {
    const weight = cell.contributes.weight;
    parts.push(`${weight > 0 ? '+' : ''}${weight} if ${sayCondition(file, cell.contributes.condition)}`);
  }
  return parts.join(' · ');
};

/**
 * The matrix in a sentence, and the two things worth saying about the set of
 * endings as a whole.
 *
 * An ending nothing can reach is stage 3's finding, and an ending **no state
 * can earn** is this module's: a threshold higher than everything that counts
 * towards it is a fact, not an opinion, and the one mistake a scored ending
 * makes that nothing else catches.
 */
export const unreachableEndings = (file: ProjectFile): { ending: NarrativeElement; says: string }[] => {
  const found = reachable(file);
  return endingsOf(file).flatMap((ending) => {
    if (!found.has(ending.id as string)) return [];
    const most = ending.contributors.filter((one) => one.weight > 0).reduce((sum, one) => sum + one.weight, 0);
    if (!isScored(ending) || most >= ending.threshold) return [];
    return [
      {
        ending,
        says: `${ending.name || 'an unnamed ending'} needs ${ending.threshold} and everything that counts towards it adds up to ${most}.`,
      },
    ];
  });
};

export const describeMatrix = (matrix: OutcomeMatrix): string => {
  if (matrix.endings.length === 0) return 'No endings yet. A node marked as an ending is one.';
  const scored = matrix.endings.filter(isScored).length;
  const parts = [`${matrix.endings.length} ending${matrix.endings.length === 1 ? '' : 's'}`];
  if (scored > 0) parts.push(`${scored} scored`);
  if (matrix.rows.length > 0) {
    parts.push(
      matrix.rows.length === 1 ? '1 thing decides them' : `${matrix.rows.length} things decide them`,
    );
  }
  return `${parts.join(' · ')}.`;
};
