import React from 'react';
import {
  ASSIGNMENT_STATE_NAMES,
  describeAssignment,
  isOverdue,
  type Assignment,
  type Attribution,
} from '@vcwriter/domain';

/**
 * Who the room is expecting this from (addendum 07 §8).
 *
 * The third angle on an assignment: the writer's landing page says what they
 * are being asked for, the dashboard says who owes what, and this stands beside
 * the scene — where a writer actually is when the question *is somebody already
 * doing this?* occurs to them.
 *
 * **It is not a lock and it is drawn so that it does not look like one.** A
 * hollow badge next to the contributor's solid one: the mark beside it says who
 * *wrote* this, and this says who is *expected to*, and they are different
 * enough to want different weights. The tooltip says it in words, because a
 * badge on a scene is exactly where somebody would otherwise assume they must
 * not touch it.
 */
export const AssignedMark = ({
  assignment,
  who,
  today,
}: {
  assignment: Assignment | null;
  /** The seat it is being asked of, where the room knows them. */
  who: Attribution | null;
  /** The day, for whether it is late. Passed in so a page agrees with itself. */
  today?: string;
}): React.ReactElement | null => {
  if (!assignment) return null;

  const late = isOverdue(assignment, today ?? new Date().toISOString().slice(0, 10));
  const name = who?.name ?? 'somebody no longer in the room';
  const said = [
    `Asked of ${name}`,
    ASSIGNMENT_STATE_NAMES[assignment.state].toLowerCase(),
    assignment.dueOn ? `wanted ${assignment.dueOn}` : null,
    describeAssignment(assignment),
    'Not a lock — anyone can write it, and both passes survive.',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <span
      className={late ? 'assigned-mark late' : 'assigned-mark'}
      style={{ '--room-colour': who?.colour || '#666666' } as React.CSSProperties}
      title={said}
    >
      {who?.initials || '—'}
    </span>
  );
};

export default AssignedMark;
