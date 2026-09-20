import { useEffect, useRef } from 'react';

/**
 * The right-click menu, one component for the whole program (from Ken:
 * *when you select something, you have the tools in a right-click menu to
 * edit it*). The manuscript, the timeline's beats and scenes and the
 * Layout rail all open this at the pointer, so a menu looks and behaves
 * the same wherever it comes up: a press anywhere else closes it, so does
 * a scroll (a menu pinned to a place on the screen is wrong the moment
 * the page moves under it), Escape closes it, and the first item takes
 * focus so the keyboard works.
 *
 * An item that cannot be done right now is **disabled with a reason** in
 * its title, never dropped: *Split the scene here* greyed on a scene's
 * first beat tells the writer why nothing happens. An item that does not
 * apply to this kind of thing at all is absent, per the program's rule.
 */

export interface MenuItem {
  label: string;
  onPick(): void;
  /** Said as the reason, and the item is greyed. */
  disabled?: string | null;
  /** Drawn red: the thing goes. */
  danger?: boolean;
}

/** A rule between groups. */
export type MenuEntry = MenuItem | 'rule';

export interface ContextMenuProps {
  x: number;
  y: number;
  label: string;
  entries: MenuEntry[];
  onClose(): void;
}

/** Kept on the screen: a menu opened near the right edge opens leftwards. */
const placed = (x: number, y: number, width = 260, height = 320): { left: number; top: number } => {
  const w = typeof window === 'undefined' ? 1600 : window.innerWidth;
  const h = typeof window === 'undefined' ? 1000 : window.innerHeight;
  return { left: Math.max(0, Math.min(x, w - width)), top: Math.max(0, Math.min(y, h - height)) };
};

export function ContextMenu({ x, y, label, entries, onClose }: ContextMenuProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const away = () => onClose();
    window.addEventListener('pointerdown', away);
    window.addEventListener('scroll', away, true);
    window.addEventListener('resize', away);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('scroll', away, true);
      window.removeEventListener('resize', away);
    };
  }, [onClose]);

  return (
    <div
      ref={panel}
      className="context-menu"
      role="menu"
      aria-label={label}
      style={placed(x, y)}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
          const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = buttons[(at + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length];
          next?.focus();
        }
      }}
    >
      {entries.map((entry, index) =>
        entry === 'rule' ? (
          <hr key={`rule-${index}`} className="context-rule" />
        ) : (
          <button
            key={`${entry.label}-${index}`}
            type="button"
            role="menuitem"
            className={entry.danger ? 'context-item danger' : 'context-item'}
            disabled={Boolean(entry.disabled)}
            title={entry.disabled ?? undefined}
            onClick={() => {
              entry.onPick();
              onClose();
            }}
          >
            {entry.label}
          </button>
        ),
      )}
    </div>
  );
}
