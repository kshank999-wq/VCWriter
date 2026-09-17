export type View = 'home' | 'outline' | 'write' | 'preview' | 'editor' | 'readback' | 'account' | 'recovery';

/** Research and setups are tabs of the master panel now (addendum 02 §6). */
export const VIEWS: ReadonlyArray<{ id: View; label: string }> = [
  // First, because it is the project rather than a tool for working on it
  // (master spec §4). It is not the page the application opens on: a writer
  // opening a file wants the writing, not a dashboard about it.
  { id: 'home', label: 'Home' },
  // A book's outline, before its writing, and the page a book opens on
  // (addendum 19 §5): a textbook is planned before it is written. On every
  // other format the Outliner is a room, and this page is not on the bar.
  { id: 'outline', label: 'Outline' },
  { id: 'write', label: 'Write' },
  { id: 'preview', label: 'Preview' },
  { id: 'editor', label: 'Editors' },
  { id: 'readback', label: 'Read back' },
  { id: 'account', label: 'Account' },
  { id: 'recovery', label: 'Recovery' },
];

interface PageBarProps {
  view: View;
  onSelect(view: View): void;
  /** A count to show after a page's name: unread research, open setups, conflicts. */
  counts: Partial<Record<View, number>>;
  /**
   * Pages that are in a window of their own (addendum 02 §8).
   *
   * Marked rather than removed: a page taken to another monitor is still a
   * page of this project, and a writer who cannot find *Editors* on the bar
   * would conclude the build had lost it. Choosing it raises that window,
   * which the workspace arranges — this only says which.
   */
  out?: readonly View[];
  /**
   * Pages this project does not have, left off the bar rather than greyed
   * (addendum 19 §5): a screenplay has no Outline page, and a disabled one
   * would say *not yet* about something that is never coming.
   */
  hidden?: readonly View[];
}

/**
 * The row of pages along the bottom of the window (addendum 02 §7): the one
 * piece of chrome shared by every page, where an editing application keeps
 * it, so the title bar can be nothing but the project and its state.
 */
export function PageBar({ view, onSelect, counts, out = [], hidden = [] }: PageBarProps) {
  return (
    <nav className="page-bar" aria-label="Pages">
      {VIEWS.filter((option) => !hidden.includes(option.id)).map((option) => {
        const count = counts[option.id];
        const away = out.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            className={[view === option.id ? 'page selected' : 'page', away ? 'away' : ''].filter(Boolean).join(' ')}
            aria-current={view === option.id && !away ? 'page' : undefined}
            title={away ? `${option.label} is in a window of its own — this brings it forward` : undefined}
            onClick={() => onSelect(option.id)}
          >
            {option.label}
            {away ? <span className="page-away" aria-label="in its own window"> ⧉</span> : null}
            {count ? <span className="page-count">{count}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
