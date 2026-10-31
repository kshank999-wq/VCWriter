import type { BookHeading } from '@vcwriter/domain';

/**
 * A book's section or subsection heading, drawn in the manuscript as it
 * prints — the number bold and to the left, the title in title case — with
 * the switch that takes it out (from Ken: *you need the option to be able to
 * turn those on or off. So if you want to merge two sections, you can just
 * turn off that label*). A heading switched off stays visible here, faint
 * and struck through, so it can be switched back on; it prints nothing.
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
