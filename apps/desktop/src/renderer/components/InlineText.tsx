import { useEffect, useRef, useState } from 'react';

interface InlineTextProps {
  value: string;
  placeholder?: string;
  className?: string;
  ariaLabel: string;
  onCommit(value: string): void;
}

/**
 * Click-to-rename text. Escape abandons the edit, Enter and blur commit it.
 *
 * Renaming in place matters more here than it looks: story links reference
 * entities by id and resolve the name at display time (spec §7.4), so a rename
 * done here propagates to every panel that mentions it.
 */
export function InlineText({ value, placeholder, className, ariaLabel, onCommit }: InlineTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        className={`inline-text ${className ?? ''}`}
        title="Click to rename"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value.length > 0 ? value : <span className="muted">{placeholder ?? 'Untitled'}</span>}
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
