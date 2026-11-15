import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { shotChoices } from '@vcwriter/domain';

/**
 * A box for a shot's framing or its camera move, that finishes the word as it
 * is typed (from Ken, 15 November: *if you start typing it, it'll
 * automatically fill it in… you can just type in C and then that shot will
 * come up*).
 *
 * The best match is written into the box with the rest of it selected, the
 * way an address bar does — so typing on replaces the guess, Backspace takes
 * it off, and Enter or Tab keeps it. The other matches drop down below, and
 * the arrow keys or a click choose among them. Anything may be typed: the
 * list offers, it does not insist.
 */
export function ShotPicker({
  label,
  placeholder,
  value,
  list,
  onChange,
  className,
}: {
  label: string;
  placeholder: string;
  value: string;
  list: ReadonlyArray<{ name: string; short: string }>;
  onChange(next: string): void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  /** What the writer has actually typed, as against the guess filled in after it. */
  const [typed, setTyped] = useState(value);
  const [active, setActive] = useState(0);
  const pendingSelection = useRef<[number, number] | null>(null);

  // Every match, scrolled within the list (from Ken: *it stops at medium
  // close-up*), rather than the first eight.
  const choices = open ? shotChoices(typed, list) : [];

  /**
   * **Drawn over the page, not inside the row** (from Ken, 15 November: *it
   * pops underneath the shot below it*). The sheet's rows clip and stack
   * their contents, so the list is placed on the page itself, under the box —
   * or above it where there is no room below — and follows it as the sheet
   * scrolls.
   */
  const [place, setPlace] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  useEffect(() => {
    if (choices.length === 0) {
      setPlace(null);
      return;
    }
    const measure = (event?: Event) => {
      // Scrolling the list itself moves nothing.
      if (event && listRef.current && event.target instanceof Node && listRef.current.contains(event.target)) return;
      const box = input.current?.getBoundingClientRect();
      if (!box) return;
      const below = window.innerHeight - box.bottom - 12;
      const above = box.top - 12;
      const roomBelow = below >= 180 || below >= above;
      const maxHeight = Math.max(120, Math.min(300, roomBelow ? below : above));
      const next = {
        left: box.left,
        width: box.width,
        maxHeight,
        top: roomBelow ? box.bottom + 2 : box.top - 2 - Math.min(maxHeight, choices.length * 30 + 8),
      };
      setPlace((was) =>
        was && was.left === next.left && was.top === next.top && was.width === next.width && was.maxHeight === next.maxHeight ? was : next,
      );
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [choices.length]);
  const listRef = useRef<HTMLUListElement>(null);
  // The highlighted one kept in view as the arrows move through a long list.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  useLayoutEffect(() => {
    const range = pendingSelection.current;
    if (!range || !input.current) return;
    pendingSelection.current = null;
    input.current.setSelectionRange(range[0], range[1]);
  });

  const fill = (text: string, guess: string | undefined) => {
    // Only a guess that carries on from what was typed is written in.
    if (guess && text && guess.toLowerCase().startsWith(text.toLowerCase()) && guess.length > text.length) {
      // In the list's own spelling: *c* becomes *Cowboy shot*, not *cowboy shot*.
      onChange(guess);
      pendingSelection.current = [text.length, guess.length];
    } else {
      onChange(text);
    }
  };

  const choose = (name: string) => {
    onChange(name);
    setTyped(name);
    setOpen(false);
    pendingSelection.current = [name.length, name.length];
  };

  return (
    <span className={`shot-picker${className ? ` ${className}` : ''}`}>
      <input
        ref={input}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={choices.length > 0}
        aria-controls={listId}
        aria-autocomplete="both"
        placeholder={placeholder}
        value={value}
        onFocus={() => {
          setTyped(value);
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          const text = event.target.value;
          const deleting = (event.nativeEvent as InputEvent).inputType?.startsWith('delete') ?? false;
          setTyped(text);
          setActive(0);
          setOpen(true);
          if (deleting) onChange(text);
          else fill(text, shotChoices(text, list)[0]);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            const all = shotChoices(typed, list);
            if (all.length === 0) return;
            event.preventDefault();
            setOpen(true);
            const next = (active + (event.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length;
            setActive(next);
            onChange(all[next]!);
            pendingSelection.current = [all[next]!.length, all[next]!.length];
          } else if (event.key === 'Enter') {
            event.preventDefault();
            choose(value);
          } else if (event.key === 'Escape') {
            if (!open) return;
            event.preventDefault();
            event.stopPropagation();
            onChange(typed);
            setOpen(false);
          }
        }}
      />
      {choices.length > 0 && place
        ? createPortal(
            <ul
              ref={listRef}
              className="shot-picker-list"
              id={listId}
              role="listbox"
              aria-label={`${label}: choices`}
              style={{ position: 'fixed', left: place.left, top: place.top, width: place.width, maxHeight: place.maxHeight }}
            >
              {choices.map((name, index) => (
                <li
                  key={name}
                  role="option"
                  data-active={index === active}
                  aria-selected={index === active || name === value}
                  className={name === value ? 'on' : undefined}
                  // Before the box loses focus, or the click lands on nothing.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(name);
                  }}
                >
                  {name}
                </li>
              ))}
            </ul>,
            // Inside a pop-up, into it: a modal dialog sits above the page itself.
            input.current?.closest('dialog') ?? document.body,
          )
        : null}
    </span>
  );
}
