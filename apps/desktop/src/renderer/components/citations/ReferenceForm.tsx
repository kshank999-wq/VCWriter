import { useEffect, useMemo, useState } from 'react';
import {
  REFERENCE_FIELDS,
  REFERENCE_TYPE_NAMES,
  fieldLabel,
  referenceProblems,
  referenceTypeSchema,
  type Reference,
  type ReferenceField,
  type ReferenceInput,
  type ReferenceType,
} from '@vcwriter/domain';

/**
 * **A source's facts** (addendum 43, spec §3): the form the Reference Library
 * edits and *Edit Source* opens from a citation.
 *
 * Only the fields a kind of source has are shown — a journal article asks for
 * a volume and an issue, a website for when it was read — and each field says
 * what is wrong with it under itself, in words, as it is typed. People are one
 * a line, *Last, First*, which is the one form every style can turn into its
 * own.
 */

const PEOPLE: ReferenceField[] = ['authors', 'editors'];

const PLACEHOLDERS: Partial<Record<ReferenceField, string>> = {
  authors: 'One a line: Smith, Jane',
  editors: 'One a line: Lee, Ann',
  date: '2024, 2024-03 or 2024-03-15',
  accessed: '2024-03-15',
  doi: '10.1000/xyz123',
  url: 'https://',
  pages: '101-120',
};

interface ReferenceFormProps {
  reference: Reference;
  readOnly?: boolean;
  onChange(patch: ReferenceInput): void;
}

export function ReferenceForm({ reference, readOnly = false, onChange }: ReferenceFormProps) {
  const problems = useMemo(() => referenceProblems(reference), [reference]);
  const fields = REFERENCE_FIELDS[reference.type];
  const field = (name: ReferenceField) => {
    const id = `ref-${reference.id}-${name}`;
    const label = fieldLabel(reference.type, name);
    const problem = problems[name];
    const people = PEOPLE.includes(name);
    const value = people ? (reference[name] as string[]).join('\n') : String(reference[name] ?? '');
    return (
      <div key={name} className={`ref-field ${name}${problem ? ' wrong' : ''}`}>
        <label htmlFor={id}>{label}</label>
        {people ? (
          <ListText
            id={id}
            multiline
            value={value}
            placeholder={PLACEHOLDERS[name]}
            readOnly={readOnly}
            split={(text) => text.split('\n')}
            onCommit={(items) => onChange({ [name]: items })}
          />
        ) : (
          <input
            id={id}
            value={value}
            placeholder={PLACEHOLDERS[name]}
            readOnly={readOnly}
            aria-invalid={problem ? true : undefined}
            onChange={(event) => onChange({ [name]: event.target.value })}
          />
        )}
        {problem ? (
          <span className="ref-problem" role="alert">
            {problem}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="ref-form">
      <div className="ref-field type">
        <label htmlFor={`ref-${reference.id}-type`}>Kind of source</label>
        <select
          id={`ref-${reference.id}-type`}
          value={reference.type}
          disabled={readOnly}
          onChange={(event) => onChange({ type: event.target.value as ReferenceType })}
        >
          {referenceTypeSchema.options.map((type) => (
            <option key={type} value={type}>
              {REFERENCE_TYPE_NAMES[type]}
            </option>
          ))}
        </select>
      </div>
      <div className="ref-field short">
        <label htmlFor={`ref-${reference.id}-short`}>Short code</label>
        <input
          id={`ref-${reference.id}-short`}
          value={reference.shortCode}
          placeholder="Smith2024 — yours, never printed"
          readOnly={readOnly}
          onChange={(event) => onChange({ shortCode: event.target.value })}
        />
      </div>
      {fields.map(field)}
      <div className="ref-field tags">
        <label htmlFor={`ref-${reference.id}-tags`}>Tags</label>
        <ListText
          id={`ref-${reference.id}-tags`}
          value={reference.tags.join(', ')}
          placeholder="history, primary source"
          readOnly={readOnly}
          split={(text) => text.split(',')}
          onCommit={(items) => onChange({ tags: [...new Set(items)] })}
        />
      </div>
      <div className="ref-field notes">
        <label htmlFor={`ref-${reference.id}-notes`}>Notes</label>
        <textarea
          id={`ref-${reference.id}-notes`}
          rows={3}
          value={reference.notes}
          placeholder="Your own notes on the source. Not printed."
          readOnly={readOnly}
          onChange={(event) => onChange({ notes: event.target.value })}
        />
      </div>
    </div>
  );
}

/**
 * A list typed as text — people one a line, tags with commas. The text is the
 * writer's while they type, so the comma or the new line they have just put
 * in is not tidied away under them; the list saved is the text's non-empty
 * items, on every keystroke.
 */
function ListText({
  id,
  value,
  placeholder,
  readOnly,
  multiline = false,
  split,
  onCommit,
}: {
  id: string;
  value: string;
  placeholder?: string;
  readOnly: boolean;
  multiline?: boolean;
  split(text: string): string[];
  onCommit(items: string[]): void;
}) {
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  // From outside (another source chosen, an undo) while the writer is not in it.
  useEffect(() => {
    if (!editing) setText(value);
  }, [value, editing]);
  const change = (next: string) => {
    setText(next);
    onCommit(split(next).map((item) => item.trim()).filter(Boolean));
  };
  const shared = {
    id,
    value: text,
    placeholder,
    readOnly,
    onFocus: () => setEditing(true),
    onBlur: () => setEditing(false),
  };
  return multiline ? (
    <textarea {...shared} rows={Math.max(1, Math.min(4, text.split('\n').length))} onChange={(event) => change(event.target.value)} />
  ) : (
    <input {...shared} onChange={(event) => change(event.target.value)} />
  );
}
