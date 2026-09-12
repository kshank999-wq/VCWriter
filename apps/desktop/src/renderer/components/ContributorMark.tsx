import React from 'react';
import type { Attribution } from '@vcwriter/domain';

/**
 * Who wrote this, in two letters (addendum 07 §6.2).
 *
 * Small, and the same everywhere: a scene, a beat, a card on the board and a
 * row in the outline all wear the same mark, so a writer learns one thing
 * rather than four. It is deliberately not the beat's own colour swatch —
 * that is a fact about the story, this is a fact about the room, and two
 * colour languages in one place is neither (§6.2).
 *
 * Nothing at all where there is nobody to name: outside a room, on the master,
 * in clean reading, or for an author whose seat this room does not have. A
 * grey badge saying *somebody* wrote this is worse than silence.
 */
export const ContributorMark = ({ who }: { who: Attribution | null }): React.ReactElement | null => {
  if (!who) return null;
  return (
    <span
      className="contributor-mark"
      style={{ '--room-colour': who.colour || '#666666' } as React.CSSProperties}
      title={`${who.name}${who.title ? ` — ${who.title}` : ''}`}
    >
      {who.initials}
    </span>
  );
};

export default ContributorMark;
