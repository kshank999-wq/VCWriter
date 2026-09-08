import { useEffect, useRef, useState } from 'react';

interface InlineTextProps {
  value: string;
  placeholder?: string;
  className?: string;
  ariaLabel: string;
  onCommit(value: string): void;
  /**
   * How the rename starts. `click` is the usual thing. `doubleClick` is for
   * text that already sits inside something clickable — a folder in the
   * research tree, where a single click opens the folder — and renders plain
   * text rather than a control, which is also the only valid markup there.
   */
  begin?: 'click' | 'doubleClick';
}

/**
 * Click-to-rename text. Escape abandons the edit, Enter and blur commit it.
 *
 * Renaming in place matters more here than it looks: story links reference
 * entities by id and resolve the name at display time (spec §7.4), so a rename
 * done here propagates to every panel that mentions it.
 */
export function InlineText({ value, placeholder, className, ariaLabel, onCommit, begin = 'click' }: InlineTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const start = () => {
    setDraft(value);
    setEditing(true);
  };

  const label = value.length > 0 ? value : <span className="muted">{placeholder ?? 'Untitled'}</span>;

  if (!editing && begin === 'doubleClick') {
    return (
      <span className={`inline-text ${className ?? ''}`} title="Double-click to rename" onDoubleClick={start}>
        {label}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        className={`inline-text ${className ?? ''}`}
        title="Click to rename"
        // Without this a screen reader announces "Main Plot, button" and never
        // says what Main Plot is, or that the button renames it (§15).
        aria-label={`${ariaLabel}: ${value.length > 0 ? value : (placeholder ?? 'Untitled')}`}
        onClick={start}
      >
        {label}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== value) onCommit(next);
  };

  return (
    <input
      ref={inputRef}
      className={`inline-input ${className ?? ''}`}
      aria-label={ariaLabel}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setEditing(false);
        }
      }}
    />
  );
}
