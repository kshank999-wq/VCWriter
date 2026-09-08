import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  autoType,
  CHARACTER_EXTENSIONS,
  cueSuggestions,
  cuesInOrder,
  defaultElementType,
  elementTypesFor,
  layoutFor,
  newId,
  onEnter,
  onTab,
  styleShortcuts,
  updateBeat,
  type Beat,
  type ManuscriptElement,
  type ManuscriptElementId,
  type ManuscriptElementType,
  type ProjectFile,
  type Typing,
} from '@vcwriter/domain';

interface BeatBodyProps {
  file: ProjectFile;
  beat: Beat;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** The writer put the cursor in this beat. */
  onActivate(): void;
  /**
   * Element id -> printed page number, from the paginator: an element that
   * opens a page is drawn under a page rule. Null draws no page breaks.
   */
  breaks?: Map<string, number> | null;
  /** Shot detection: "ANGLE ON" becomes a shot. Off by default, as elsewhere. */
  detectShots?: boolean;
  /**
   * What an empty beat offers. Null shows nothing, which is what the Script
   * wants: a beat with no words is a blank on the page, not a button.
   */
  emptyLabel?: string | null;
}

/**
 * The manuscript of one beat, editable, at the real page geometry (spec §6).
 *
 * The keyboard is the one every screenwriting program has trained into its
 * writers, and the rules live in the domain (`editing.ts`) rather than in
 * this keydown handler:
 *
 *  - **Tab** reaches for the next mode — action to a character cue, dialogue
 *    to a parenthetical — starting a new line, or re-typing the line in hand
 *    when it is still empty.
 *  - **Return** continues what you are doing: a cue gives dialogue, dialogue
 *    gives action, a transition gives the next slugline.
 *  - **Ctrl/Cmd+1…9** sets the style outright.
 *  - A line of action that opens with `INT.`/`EXT.`, or that reads `CUT TO:`,
 *    becomes what it plainly is.
 *  - Cues complete from the cast, offering whoever is most likely to speak
 *    next, and sluglines from the locations the script already uses.
 *
 * The Script stacks one of these per beat and the writing screen shows one at
 * a time; neither knows about the other. Return at the end of a beat stays in
 * the beat — crossing into the next one is a click or an arrow past the edge.
 */
export function BeatBody({
  file,
  beat,
  onUpdate,
  onActivate,
  breaks = null,
  detectShots = false,
  emptyLabel = 'Start writing this beat',
}: BeatBodyProps) {
  const format = file.project.format;
  const layout = layoutFor(format);
  const elementTypes = elementTypesFor(format);
  const shortcuts = useMemo(() => styleShortcuts(format), [format]);

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

  /**
   * Who to offer while a cue is being typed: the beat's own speakers first,
   * least-recent of them ahead of whoever just spoke, then the rest of the
   * cast. Each of the likeliest few is offered with its extensions too.
   */
  const cues = useMemo(() => {
    const everyone = [
      ...file.characters.map((character) => character.name),
      ...file.beats.flatMap((candidate) => cuesInOrder(candidate.manuscript)),
    ];
    const suggestions = cueSuggestions(everyone, cuesInOrder(beat.manuscript));
    return [
      ...suggestions,
      ...suggestions.slice(0, 3).flatMap((name) => CHARACTER_EXTENSIONS.map((extension) => `${name} ${extension}`)),
    ];
  }, [file.characters, file.beats, beat.manuscript]);

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

  /** A keystroke's verdict: a new line in that style, or this line re-typed. */
  const applyTyping = (typing: Typing, element: ManuscriptElement, index: number) => {
    if (typing.newLine) insertAfter(index, typing.type);
    else updateElement(element.id, { type: typing.type });
  };

  /** Text as it is typed, and the style the line turns out to be. */
  const writeText = (element: ManuscriptElement, text: string) => {
    const become = autoType(format, element.type, text, { detectShots });
    updateElement(element.id, become ? { text, type: become } : { text });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>, element: ManuscriptElement, index: number) => {
    const input = event.currentTarget;
    const empty = element.text.trim().length === 0;

    // Ctrl/Cmd+1…9 sets the paragraph style outright.
    if ((event.metaKey || event.ctrlKey) && !event.altKey && shortcuts[event.key]) {
      event.preventDefault();
      updateElement(element.id, { type: shortcuts[event.key] as ManuscriptElementType });
      return;
    }

    // Return continues what you are doing.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      applyTyping(onEnter(format, element.type, empty), element, index);
      return;
    }

    // Tab reaches for the next mode rather than moving focus.
    if (event.key === 'Tab') {
      event.preventDefault();
      applyTyping(onTab(format, element.type, empty, event.shiftKey ? -1 : 1), element, index);
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
      {/* The cue list is the beat's own: it is ordered for this beat. */}
      <datalist id={`cues-${beat.id}`}>
        {cues.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {elements.map((element, index) => {
        const indent = layout.indent[element.type] ?? 0;
        const width = layout.width[element.type] ?? layout.columns;
        const page = breaks?.get(element.id);
        return (
          <Fragment key={element.id}>
            {page ? (
              <div className="page-break" aria-label={`Page ${page} starts here`}>
                <span>{page}.</span>
              </div>
            ) : null}
            <div
              className={`element element-${element.type}`}
              // The page geometry as variables, so a narrow column can trade the
              // fixed width for the room it has without losing the indent.
              style={{ '--indent': `${indent}ch`, '--width': `${width}ch` } as React.CSSProperties}
            >
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
                style={{ marginLeft: 'var(--indent)', width: 'var(--width)' }}
                rows={Math.max(1, Math.ceil((element.text.length || 1) / width) + element.text.split('\n').length - 1)}
                placeholder={element.type.replace(/_/g, ' ')}
                value={element.text}
                {...(element.type === 'character'
                  ? { list: `cues-${beat.id}` }
                  : element.type === 'scene_heading'
                    ? { list: 'vcwriter-slugs' }
                    : {})}
                onFocus={onActivate}
                onChange={(event) => writeText(element, event.target.value)}
                onKeyDown={(event) => handleKeyDown(event, element, index)}
              />
            </div>
          </Fragment>
        );
      })}

      {elements.length === 0 && emptyLabel ? (
        <button
          type="button"
          className="ghost add-element"
          onClick={() => {
            onActivate();
            insertAfter(-1, defaultElementType(format));
          }}
        >
          {emptyLabel}
        </button>
      ) : null}
    </div>
  );
}
