import { useEffect, useRef, useState } from 'react';
import {
  cycleType,
  defaultElementType,
  elementTypesFor,
  layoutFor,
  newId,
  typeOnEnter,
  updateBeat,
  type Beat,
  type ManuscriptElement,
  type ManuscriptElementId,
  type ManuscriptElementType,
  type ProjectFile,
} from '@vcwriter/domain';

interface BeatBodyProps {
  file: ProjectFile;
  beat: Beat;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** The writer put the cursor in this beat. */
  onActivate(): void;
}

/**
 * The manuscript of one beat, editable, at the real page geometry (spec §6).
 *
 * Elements use the same indents and column widths the paginator and the PDF
 * use, so the shape of the page is visible while writing. The keyboard does
 * what a screenwriter expects: Return after a character cue starts dialogue,
 * Return after dialogue goes back to action, Tab cycles the element type.
 * Those rules live in the domain (`editing.ts`), not here.
 *
 * The Story View stacks one of these per beat (addendum 02 §4); nothing in
 * here knows about neighbours, so Return at the end of a beat stays in the
 * beat. Crossing into the next beat is a click or an arrow past the edge.
 */
export function BeatBody({ file, beat, onUpdate, onActivate }: BeatBodyProps) {
  const format = file.project.format;
  const layout = layoutFor(format);
  const elementTypes = elementTypesFor(format);

  const [focusId, setFocusId] = useState<ManuscriptElementId | null>(null);
  const inputs = useRef(new Map<ManuscriptElementId, HTMLTextAreaElement>());

  useEffect(() => {
    if (!focusId) return;
    const input = inputs.current.get(focusId);
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    setFocusId(null);
  }, [focusId, beat.manuscript.elements.length]);

  const elements = beat.manuscript.elements;

  const setElements = (next: ManuscriptElement[]) => {
    onUpdate((current) => updateBeat(current, beat.id, { manuscript: { elements: next } }));
  };

  const updateElement = (id: ManuscriptElementId, patch: Partial<ManuscriptElement>) => {
    setElements(elements.map((element) => (element.id === id ? { ...element, ...patch } : element)));
  };

  const makeElement = (type: ManuscriptElementType): ManuscriptElement => ({
    id: newId<ManuscriptElementId>(),
    type,
    text: '',
    characterId: null,
    attributes: {},
  });

  const insertAfter = (index: number, type: ManuscriptElementType) => {
    const element = makeElement(type);
    const next = [...elements];
    next.splice(index + 1, 0, element);
    setElements(next);
    setFocusId(element.id);
  };

  const removeAt = (index: number) => {
    const previous = elements[index - 1];
    setElements(elements.filter((_, position) => position !== index));
    if (previous) setFocusId(previous.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>, element: ManuscriptElement, index: number) => {
    const input = event.currentTarget;

    // Return starts the element that conventionally follows this one.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      insertAfter(index, typeOnEnter(format, element.type));
      return;
    }

    // Tab re-types the current element rather than moving focus.
    if (event.key === 'Tab') {
      event.preventDefault();
      updateElement(element.id, { type: cycleType(format, element.type, event.shiftKey ? -1 : 1) });
      return;
    }

    // Backspace at the very start of an empty element removes it.
    if (event.key === 'Backspace' && input.selectionStart === 0 && input.selectionEnd === 0) {
      if (element.text.length === 0 && elements.length > 1) {
        event.preventDefault();
        removeAt(index);
      }
      return;
    }

    if (event.key === 'ArrowUp' && input.selectionStart === 0) {
      const previous = elements[index - 1];
      if (previous) {
        event.preventDefault();
        setFocusId(previous.id);
      }
      return;
    }

    if (event.key === 'ArrowDown' && input.selectionStart === input.value.length) {
      const next = elements[index + 1];
      if (next) {
        event.preventDefault();
        setFocusId(next.id);
      }
    }
  };

  return (
    <div className="page-column" style={{ width: `${layout.columns}ch` }}>
      {elements.map((element, index) => {
        const indent = layout.indent[element.type] ?? 0;
        const width = layout.width[element.type] ?? layout.columns;
        return (
          <div key={element.id} className={`element element-${element.type}`}>
            <select
              className="element-type"
              value={element.type}
              aria-label="Element type"
              onChange={(event) => updateElement(element.id, { type: event.target.value as ManuscriptElementType })}
            >
              {elementTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <textarea
              ref={(node) => {
                if (node) inputs.current.set(element.id, node);
                else inputs.current.delete(element.id);
              }}
              style={{ marginLeft: `${indent}ch`, width: `${width}ch` }}
              rows={Math.max(1, Math.ceil((element.text.length || 1) / width) + element.text.split('\n').length - 1)}
              placeholder={element.type.replace(/_/g, ' ')}
              value={element.text}
              {...(element.type === 'character' ? { list: 'vcwriter-characters' } : {})}
              onFocus={onActivate}
              onChange={(event) => updateElement(element.id, { text: event.target.value })}
              onKeyDown={(event) => handleKeyDown(event, element, index)}
            />
          </div>
        );
      })}

      {elements.length === 0 ? (
        <button
          type="button"
          className="ghost add-element"
          onClick={() => {
            onActivate();
            insertAfter(-1, defaultElementType(format));
          }}
        >
          Start writing this beat
        </button>
      ) : null}
    </div>
  );
}
