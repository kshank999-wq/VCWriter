import { useEffect, useRef, useState } from 'react';
import { MENUS, matchesAccelerator, prettyAccelerator, type CommandId, type Menu } from '../menus';

interface MenuBarProps {
  /**
   * The menus to draw. The workspace works them out from the project that is
   * open — a series has an episode item and a novel does not — and hands the
   * same list to the native menu, so the two can never disagree.
   */
  menus?: readonly Menu[];
  /** Run a command. Everything the menus do goes through here. */
  onCommand(command: CommandId): void;
  /** Commands that are currently on, for the ticks. */
  checked: ReadonlySet<CommandId>;
  /** Commands that cannot be run right now, greyed rather than hidden. */
  disabled?: ReadonlySet<CommandId>;
  /** The platform, for the accelerators; the native menu handles the rest. */
  mac: boolean;
  /** True when the main process is drawing the real menu as well (macOS). */
  native?: boolean;
}

/**
 * The menu bar drawn in the window (addendum 02 §13).
 *
 * A desktop application has menus, and this one is the same list the native
 * menu is built from, so the two can never say different things. It is drawn
 * here rather than relied on natively because the browser preview has no
 * native menu at all, and because on Windows the menu belongs inside the
 * window with the rest of the chrome.
 *
 * On a Mac the system menu is the real one and this bar is redundant; it is
 * hidden there rather than duplicated, and the accelerators are left to the
 * native menu so a keystroke is not handled twice.
 */
export function MenuBar({ menus = MENUS, onCommand, checked, disabled, mac, native = false }: MenuBarProps) {
  const [open, setOpen] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  // Click away or press Escape and the menu closes, as menus do.
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!bar.current?.contains(event.target as Node)) setOpen(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    const timer = window.setTimeout(() => document.addEventListener('mousedown', away), 0);
    document.addEventListener('keydown', escape);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  /**
   * The accelerators, when nothing native is claiming them. A keystroke that
   * belongs to a menu item is the menu item, wherever the cursor happens to
   * be — that is the point of an accelerator — but a disabled command stays
   * disabled.
   */
  useEffect(() => {
    if (native) return;
    const handler = (event: KeyboardEvent) => {
      for (const menu of menus) {
        for (const item of menu.items) {
          if (!item?.accelerator || !matchesAccelerator(event, item.accelerator)) continue;
          if (disabled?.has(item.command)) return;
          event.preventDefault();
          setOpen(null);
          onCommand(item.command);
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [native, onCommand, disabled, menus]);

  if (native) return null;

  return (
    <div className="menu-bar" ref={bar} role="menubar" aria-label="Menu">
      {menus.map((menu) => (
        <MenuButton
          key={menu.id}
          menu={menu}
          open={open === menu.id}
          onOpen={() => setOpen(open === menu.id ? null : menu.id)}
          // Once one is open, running the pointer along the bar opens the
          // next, which is what every menu bar has always done.
          onHover={() => setOpen((current) => (current === null ? null : menu.id))}
          onPick={(command) => {
            setOpen(null);
            onCommand(command);
          }}
          checked={checked}
          disabled={disabled}
          mac={mac}
        />
      ))}
    </div>
  );
}

function MenuButton({
  menu,
  open,
  onOpen,
  onHover,
  onPick,
  checked,
  disabled,
  mac,
}: {
  menu: Menu;
  open: boolean;
  onOpen(): void;
  onHover(): void;
  onPick(command: CommandId): void;
  checked: ReadonlySet<CommandId>;
  disabled?: ReadonlySet<CommandId>;
  mac: boolean;
}) {
  return (
    <div className="menu">
      <button
        type="button"
        className={open ? 'menu-title open' : 'menu-title'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onOpen}
        onMouseEnter={onHover}
      >
        {menu.label}
      </button>
      {open ? (
        <div className="menu-drop" role="menu" aria-label={menu.label}>
          {menu.items.map((item, index) =>
            item === null ? (
              <hr key={`rule-${index}`} className="menu-rule" />
            ) : (
              <button
                key={item.command}
                type="button"
                role="menuitem"
                className="menu-item"
                disabled={disabled?.has(item.command)}
                aria-checked={item.checkable ? checked.has(item.command) : undefined}
                onClick={() => onPick(item.command)}
              >
                <span className="menu-tick" aria-hidden="true">
                  {item.checkable && checked.has(item.command) ? '✓' : ''}
                </span>
                <span className="menu-label">{item.label}</span>
                {item.accelerator ? (
                  <span className="menu-key muted">{prettyAccelerator(item.accelerator, mac)}</span>
                ) : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
