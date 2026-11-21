import type { BookHeading } from '@vcwriter/domain';

/**
 * A book's section or subsection heading, drawn in the manuscript as it
 * prints — the number bold and to the left, the title in title case — with
 * the switch that takes it out (from Ken: *you need the option to be able to
 * turn those on or off. So if you want to merge two sections, you can just
 * turn off that label*). A heading switched off is not drawn at all, here or
 * in print; the Heading tick in the writing window's top bar brings it back.
 */
export function BookHeadingLine({
  heading,
  untitled,
  onToggle,
}: {
  heading: BookHeading;
  /** What an untitled one is called, so a heading with no words says so. */
  untitled: string;
  onToggle?(shown: boolean): void;
}) {
  // A passage runs on from its subsection: no heading, not even a hidden one.
  if (heading.passage) return null;
  // **Off is gone, not crossed out** (from Ken, 21 November: *this needs to
  // not be crossed out but instead turned off*). It is switched back on with
  // the Heading tick in the writing window's top bar, or the Inspector's.
  if (!heading.shown) return null;
  const on = heading.shown;
  const Tag = heading.level === 'section' ? 'h2' : 'h3';
  return (
    <Tag className={`book-heading ${heading.level}${on ? '' : ' off'}`}>
      {heading.number ? <span className="book-heading-number">{heading.number}</span> : null}
      <span className="book-heading-title">{heading.title || <em className="muted">{untitled}</em>}</span>
      {onToggle ? (
        <button
          type="button"
          className="ghost small book-heading-toggle"
          aria-pressed={on}
          title={on ? 'In the book — click to leave this heading out, so it runs on from the one before' : 'Left out of the book — click to print it'}
          onClick={() => onToggle(!on)}
        >
          {on ? 'Heading on' : 'Heading off'}
        </button>
      ) : null}
    </Tag>
  );
}
