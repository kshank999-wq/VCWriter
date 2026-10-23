import { useMemo, useRef, useState, type TextareaHTMLAttributes } from 'react';
import {
  citationByKey,
  citationMarkers,
  insertCitation,
  isInstructional,
  tokensIn,
  updateCitation,
  type ProjectFile,
} from '@vcwriter/domain';
import { CitationDialog, type CitationChoice } from './CitationDialog';

/**
 * **A page's words, with citations in them** (addendum 43 §13): the text box
 * a foreword, an introduction, an epigraph or an appendix is written in, able
 * to cite as a chapter's lines can.
 *
 * A citation goes in as the manuscript's own `[^key]` token at the cursor, so
 * it moves with the words around it, and the book numbers it where the page
 * stands — the front matter before the story, the back matter after, and a
 * page set inside the story where it stands there. **Cite**
 * beside the box and Ctrl/Cmd+Shift+C insert one; a click inside a token opens
 * it to change or take out. Under the box, the citations it holds are listed
 * by their markers, so a writer can see which token is which.
 *
 * Only an instructional book cites; anywhere else this is the plain box.
 */

interface CitableTextProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  file: ProjectFile;
  value: string;
  onChange(text: string): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

export function CitableText({ file, value, onChange, onUpdate, onKeyDown, onClick, ...rest }: CitableTextProps) {
  const box = useRef<HTMLTextAreaElement>(null);
  /** The dialog: a citation's key to change, or null to insert one at `at`. */
  const [citing, setCiting] = useState<{ key: string | null; at: number } | null>(null);
  const cites = isInstructional(file.project.format);
  const tokens = useMemo(() => tokensIn(value), [value]);
  const markers = useMemo(() => (tokens.length > 0 ? citationMarkers(file) : new Map<string, string>()), [file, tokens.length]);

  if (!cites) return <textarea {...rest} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} onClick={onClick} />;

  const open = () => setCiting({ key: null, at: box.current?.selectionEnd ?? value.length });

  const place = (choice: CitationChoice) => {
    const opened = citing?.key ? citationByKey(file, citing.key) : null;
    if (opened) {
      onUpdate((current) => updateCitation(current, opened.id, choice));
    } else if (citing?.key) {
      // A token whose record had gone takes a new record under its own key.
      const made = insertCitation(file, choice);
      onUpdate((current) => ({ ...current, citations: [...current.citations, { ...made.citation, key: citing.key as string }] }));
    } else if (citing) {
      const made = insertCitation(file, choice);
      onUpdate((current) => ({ ...current, citations: [...current.citations, made.citation] }));
      onChange(`${value.slice(0, citing.at)}${made.token}${value.slice(citing.at)}`);
    }
    setCiting(null);
  };

  const remove = () => {
    if (!citing?.key) return;
    onChange(value.replace(`[^${citing.key}]`, ''));
    setCiting(null);
  };

  return (
    <div className="citable">
      <textarea
        {...rest}
        ref={box}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c') {
            event.preventDefault();
            open();
            return;
          }
          onKeyDown?.(event);
        }}
        onClick={(event) => {
          // A click inside a token opens its citation.
          const at = event.currentTarget.selectionStart;
          const hit = tokens.find((token) => at > token.start && at < token.end);
          if (hit) setCiting({ key: hit.key, at });
          onClick?.(event);
        }}
      />
      <div className="citable-bar">
        <button type="button" className="ghost small" onClick={open} title="Cite a source from the References library at the cursor (Ctrl+Shift+C)">
          Cite…
        </button>
        {tokens.length > 0 ? (
          <span className="muted small" aria-label="Citations in these words">
            {tokens.map((token) => `[^${token.key}] is ${markers.get(token.key) ? `note ${markers.get(token.key)}` : 'missing its source'}`).join(' · ')}
          </span>
        ) : null}
      </div>
      {citing ? (
        <CitationDialog
          file={file}
          onUpdate={onUpdate}
          citation={citing.key ? citationByKey(file, citing.key) : null}
          missingKey={citing.key && !citationByKey(file, citing.key) ? citing.key : null}
          onDone={place}
          onRemove={citing.key ? remove : undefined}
          onClose={() => setCiting(null)}
        />
      ) : null}
    </div>
  );
}
