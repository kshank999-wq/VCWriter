export type View = 'write' | 'preview' | 'editor' | 'readback' | 'captures' | 'recovery';

/** Research and setups are tabs of the master panel now (addendum 02 §6). */
export const VIEWS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'write', label: 'Write' },
  { id: 'preview', label: 'Preview' },
  { id: 'editor', label: 'Editors' },
  { id: 'readback', label: 'Read back' },
  { id: 'captures', label: 'Captures' },
  { id: 'recovery', label: 'Recovery' },
];

interface PageBarProps {
  view: View;
  onSelect(view: View): void;
  /** A count to show after a page's name: unread research, open setups, conflicts. */
  counts: Partial<Record<View, number>>;
}

/**
 * The row of pages along the bottom of the window (addendum 02 §7): the one
 * piece of chrome shared by every page, where an editing application keeps
 * it, so the title bar can be nothing but the project and its state.
 */
export function PageBar({ view, onSelect, counts }: PageBarProps) {
  return (
    <nav className="page-bar" aria-label="Pages">
      {VIEWS.map((option) => {
        const count = counts[option.id];
        return (
          <button
            key={option.id}
            type="button"
            className={view === option.id ? 'page selected' : 'page'}
            aria-current={view === option.id ? 'page' : undefined}
            onClick={() => onSelect(option.id)}
          >
            {option.label}
            {count ? <span className="page-count">{count}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
