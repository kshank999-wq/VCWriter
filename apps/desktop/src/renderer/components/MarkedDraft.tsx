import React from 'react';
import {
  MARK_KIND_NAMES,
  describeMark,
  marksOn,
  segmentsFor,
  type BeatRevision,
  type Mark,
} from '@vcwriter/domain';

/**
 * A markup draft, read with its marks on it (addendum 07 §27.2).
 *
 * A markup brought into the script arrives as a draft of the beat named for
 * the writer ("MA markup"). Read beside the working draft, it shows the marked
 * text the way the room showed it — highlight, strike, underline, a note, a
 * suggested wording — and the marks listed underneath with who made them. It
 * is never edited: it is the record of what was said.
 */
export const MarkedDraft = ({
  revision,
  onArchive,
}: {
  revision: BeatRevision;
  /** Send it to the archive, or bring it back. Nothing is erased. */
  onArchive(archived: boolean): void;
}): React.ReactElement => (
  <div className="marked-draft">
    <div className="marked-draft-page">
      {revision.manuscript.elements.map((element) => (
        <MarkedLine key={element.id} id={element.id as string} type={element.type} text={element.text} marks={marksOn(revision.marks, element.id as string)} />
      ))}
    </div>
    <div className="marked-draft-list">
      <p className="muted small">
        {revision.marks.length === 1 ? 'One mark' : `${revision.marks.length} marks`}
        {revision.markedBy ? ` by ${revision.markedBy}` : ''}
        {revision.archived ? ' · archived' : ''}
      </p>
      <ol>
        {revision.marks.map((mark) => (
          <li key={mark.id}>
            <span className={`marked-kind marked-kind-${mark.kind}`} style={mark.kind === 'highlight' ? { background: mark.colour } : undefined}>
              {MARK_KIND_NAMES[mark.kind]}
            </span>{' '}
            {describeMark(mark)}
          </li>
        ))}
      </ol>
      <button type="button" className="ghost small" onClick={() => onArchive(!revision.archived)}>
        {revision.archived ? 'Bring back from the archive' : 'Dealt with — send to archive'}
      </button>
    </div>
  </div>
);

const MarkedLine = ({ id, type, text, marks }: { id: string; type: string; text: string; marks: Mark[] }) => {
  const segments = segmentsFor(text, marks);
  let at = 0;
  return (
    <p className={`marked-line marked-${type}`} data-line={id}>
      {segments.map((segment, index) => {
        const from = at;
        at += segment.text.length;
        if (segment.marks.length === 0) return <span key={index}>{segment.text}</span>;
        const highlight = segment.marks.find((mark) => mark.kind === 'highlight');
        const ending = segment.marks.filter(
          (mark) => mark.kind === 'suggest' && Math.min(mark.end, text.length) === from + segment.text.length,
        );
        return (
          <span key={index}>
            <span
              className={segment.marks.map((mark) => `marked-${mark.kind}`).join(' ')}
              style={highlight ? { background: highlight.colour } : undefined}
              title={segment.marks.map((mark) => describeMark(mark)).join('\n')}
            >
              {segment.text}
            </span>
            {ending.map((mark) => (
              <ins key={mark.id} className="marked-insert" title={describeMark(mark)}>
                {mark.replacement}
              </ins>
            ))}
          </span>
        );
      })}
      {marks
        .filter((mark) => mark.end === mark.start)
        .map((mark) => (
          <span key={mark.id} className="marked-pin" title={mark.note}>
            ✎
          </span>
        ))}
    </p>
  );
};

export default MarkedDraft;
