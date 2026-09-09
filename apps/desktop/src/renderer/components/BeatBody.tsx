import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  autoType,
  CHARACTER_EXTENSIONS,
  EXTENSIONS,
  EXTENSION_GROUPS,
  castNamesForBeat,
  cueSuggestions,
  notedCast,
  hasExtension,
  withExtension,
  cuesInOrder,
  defaultElementType,
  elementTypesFor,
  groupManuscript,
  isDual,
  layoutFor,
  newId,
  onEnter,
  onTab,
  parseInlineMarks,
  reformatText,
  setDualDialogue,
  styleShortcuts,
  toggleInline,
  updateBeat,
  type Beat,
  type InlineMark,
  type InlineSpan,
  type ManuscriptElement,
  type ManuscriptElementId,
  type ManuscriptElementType,
  type PageLayoutSpec,
  type ProjectFile,
  type Typing,
} from '@vcwriter/domain';

interface BeatBodyProps {
  file: ProjectFile;
  beat: Beat;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** The writer put the cursor in this beat. */
  onActivate?(): void;
  /**
   * Draw it, do not let it be typed in: the draft read beside the one being
   * written (addendum 02 §19). Two live editors of the same scene is a way
   * to lose an afternoon's work.
   */
  readOnly?: boolean;
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
  /**
   * Which of the beat's elements to draw, by index. Null draws all of them.
   *
   * The page view needs this: a printed page break falls wherever the
   * paginator puts it, which is routinely in the middle of a beat, so the
   * beat's first half is drawn on one sheet and the rest on the next. The
   * keyboard, the cue list and the element ids all still work from the whole
   * beat — only the drawing is divided.
   */
  only?: ReadonlySet<number> | null;
}

const MARK_KEYS: Record<string, InlineMark> = { b: 'bold', i: 'italic', u: 'underline' };

/**
 * The manuscript of one beat, editable, at the real page geometry (spec §6).
 *
 * The keyboard is the one every screenwriting program has trained into its
 * writers, and the rules live in the domain (`editing.ts`) rather than in
 * this keydown handler:
 *
 *  - **Tab** re-types the line you are on — action to a character cue, a cue
 *    to a parenthetical — and **Shift+Tab** walks back.
 *  - **Return** starts the next line in the style that continues the work.
 *  - **Ctrl/Cmd+1…9** sets the style outright; **Ctrl/Cmd+B/I/U** puts
 *    emphasis on the selection; **Ctrl/Cmd+Alt+D** prints a speech beside
 *    the one above it.
 *  - A line of action that opens with `INT.`/`EXT.`, or that reads `CUT TO:`,
 *    becomes what it plainly is.
 *  - Cues complete from the cast, offering whoever is most likely to speak
 *    next, and sluglines from the locations the script already uses.
 *
 * Emphasis is written into the text as `**bold**`, `*italic*` and
 * `_underline_` (spec §6) and drawn over the very characters being typed:
 * behind each line sits the same text with its styling applied, so what is
 * on screen is what will print without the editor having to become a rich
 * text engine.
 */
export function BeatBody({
  file,
  beat,
  onUpdate,
  onActivate,
  breaks = null,
  detectShots = false,
  emptyLabel = 'Start writing this beat',
  only = null,
  readOnly = false,
}: BeatBodyProps) {
  const format = file.project.format;
  const layout = layoutFor(format);
  const elementTypes = elementTypesFor(format);
  const shortcuts = useMemo(() => styleShortcuts(format), [format]);

  const [focusId, setFocusId] = useState<ManuscriptElementId | null>(null);
  const [selection, setSelection] = useState<{ id: ManuscriptElementId; start: number; end: number } | null>(null);
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

  // A selection put back after an edit that moved it — emphasis, mainly.
  useEffect(() => {
    if (!selection) return;
    const input = inputs.current.get(selection.id);
    if (input) {
      input.focus();
      input.setSelectionRange(selection.start, selection.end);
    }
    setSelection(null);
  }, [selection]);

  const elements = beat.manuscript.elements;
  const items = useMemo(() => groupManuscript(elements), [elements]);

  /**
   * Who to offer while a cue is being typed: the beat's own speakers first,
   * least-recent of them ahead of whoever just spoke, then the rest of the
   * cast. Each of the likeliest few is offered with its extensions too.
   */
  const cues = useMemo(() => {
    // The cast in the order the headings put them — and in a series, this
    // episode's own cast first (addendum 02 §16, §17) — then every name that
    // has actually been typed anywhere in the project.
    const everyone = [
      ...castNamesForBeat(file, beat.id),
      ...file.beats.flatMap((candidate) => cuesInOrder(candidate.manuscript)),
    ];
    const suggestions = cueSuggestions(everyone, cuesInOrder(beat.manuscript));
    return [
      ...suggestions,
      ...suggestions.slice(0, 3).flatMap((name) => CHARACTER_EXTENSIONS.map((extension) => `${name} ${extension}`)),
    ];
  }, [file, beat.id, beat.manuscript]);

  // Tab beside a name asks which voice this is. The menu is open for one
  // element at a time, and once it has been offered for that cue the next Tab
  // walks on to the parenthetical rather than asking again.
  const [extensionsFor, setExtensionsFor] = useState<ManuscriptElementId | null>(null);
  const offered = useRef<Set<string>>(new Set());

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

  /**
   * Text pasted from somewhere else arrives as typed elements rather than as
   * one block to re-type by hand: the reformat tool reads the sluglines,
   * cues and speeches out of it (`reformat.ts`). A paste with nothing to
   * read — a phrase, a single line — is left to the ordinary paste.
   */
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>, element: ManuscriptElement, index: number) => {
    const pasted = event.clipboardData.getData('text/plain');
    if (pasted.trim().length === 0 || !pasted.includes('\n')) return;
    const parts = reformatText(pasted, format);
    if (parts.length <= 1) return;

    event.preventDefault();
    const input = event.currentTarget;
    const before = element.text.slice(0, input.selectionStart);
    const after = element.text.slice(input.selectionEnd);
    const made = parts.map((part) => ({ ...makeElement(part.type), text: part.text }));

    const next = [...elements];
    const at = before.trim().length > 0 ? index + 1 : index;
    if (before.trim().length > 0) next[index] = { ...element, text: before };
    next.splice(at, before.trim().length > 0 ? 0 : 1, ...made);
    if (after.trim().length > 0) {
      next.splice(at + made.length, 0, { ...makeElement(element.type), text: after });
    }

    setElements(next);
    const last = made[made.length - 1];
    if (last) setFocusId(last.id);
  };

  /** The character cue the given element speaks under, if it is in a speech. */
  const cueFor = (index: number): ManuscriptElement | null => {
    for (let position = index; position >= 0; position -= 1) {
      const candidate = elements[position] as ManuscriptElement;
      if (candidate.type === 'character') return candidate;
      if (candidate.type !== 'dialogue' && candidate.type !== 'parenthetical') return null;
    }
    return null;
  };

  const toggleDual = (index: number) => {
    const cue = cueFor(index);
    if (!cue) return;
    onUpdate((current) => setDualDialogue(current, beat.id, cue.id, !isDual(cue)));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>, element: ManuscriptElement, index: number) => {
    const input = event.currentTarget;
    const empty = element.text.trim().length === 0;
    const chord = event.metaKey || event.ctrlKey;

    // Ctrl/Cmd+Alt+D prints this speech beside the one above it.
    if (chord && event.altKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      toggleDual(index);
      return;
    }

    // Ctrl/Cmd+B, I, U put emphasis on the selection.
    if (chord && !event.altKey && MARK_KEYS[event.key.toLowerCase()]) {
      event.preventDefault();
      const mark = MARK_KEYS[event.key.toLowerCase()] as InlineMark;
      const edit = toggleInline(element.text, input.selectionStart, input.selectionEnd, mark);
      updateElement(element.id, { text: edit.text });
      setSelection({ id: element.id, start: edit.selectionStart, end: edit.selectionEnd });
      return;
    }

    // Ctrl/Cmd+1…9 sets the paragraph style outright.
    if (chord && !event.altKey && shortcuts[event.key]) {
      event.preventDefault();
      updateElement(element.id, { type: shortcuts[event.key] as ManuscriptElementType });
      return;
    }

    if (readOnly) return;

    // Return continues what you are doing.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      applyTyping(onEnter(format, element.type, empty), element, index);
      return;
    }

    // Tab reaches for the next mode rather than moving focus.
    if (event.key === 'Tab') {
      event.preventDefault();
      const typing = onTab(format, element.type, {
        empty,
        extensionOffered: offered.current.has(element.id as string) || hasExtension(element.text),
        direction: event.shiftKey ? -1 : 1,
      });
      if (typing.extensions) {
        offered.current.add(element.id as string);
        setExtensionsFor(element.id);
        return;
      }
      setExtensionsFor(null);
      applyTyping(typing, element, index);
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

  const row = (element: ManuscriptElement, index: number, dual: boolean) => {
    const geometry = dual && layout.dual ? layout.dual : layout;
    const indent = geometry.indent[element.type] ?? 0;
    const width = dual && layout.dual ? layout.dual.width - indent : layout.width[element.type] ?? layout.columns;
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
            disabled={readOnly}
            onChange={(event) => updateElement(element.id, { type: event.target.value as ManuscriptElementType })}
          >
            {elementTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          {element.type === 'character' && layout.dual && !readOnly ? (
            <button
              type="button"
              className={isDual(element) ? 'dual-toggle on' : 'dual-toggle'}
              aria-pressed={isDual(element)}
              aria-label="Print beside the speech above"
              title="Print beside the speech above (Ctrl/Cmd+Alt+D)"
              onClick={() => toggleDual(index)}
            >
              ⇹
            </button>
          ) : null}
          <div className="field">
            {/* The same characters as the box above it, styled: what is typed
                is what will print, marks and all, in place. */}
            <div className="ink" aria-hidden="true">
              <Marked text={element.text} />
            </div>
            <textarea
              ref={(node) => {
                if (node) inputs.current.set(element.id, node);
                else inputs.current.delete(element.id);
              }}
              rows={1}
              placeholder={element.type.replace(/_/g, ' ')}
              value={element.text}
              {...(element.type === 'character'
                ? { list: `cues-${beat.id}` }
                : element.type === 'scene_heading'
                  ? { list: 'vcwriter-slugs' }
                  : {})}
              readOnly={readOnly}
              onFocus={onActivate}
              // A name typed as a cue is a character. Noted when the writer
              // leaves the line rather than on every keystroke, so R, RU, RUV
              // do not become three people (addendum 02 §16).
              onBlur={() => {
                if (element.type !== 'character' || element.text.trim().length === 0) return;
                onUpdate((current) => notedCast(current));
              }}
              onChange={(event) => writeText(element, event.target.value)}
              onPaste={(event) => handlePaste(event, element, index)}
              onKeyDown={(event) => handleKeyDown(event, element, index)}
            />
          </div>

          {/* Which voice is this? Offered beside the name, closed by choosing
              one or by pressing Escape (addendum 02 §19). */}
          {extensionsFor === element.id ? (
            <ExtensionMenu
              onPick={(mark) => {
                updateElement(element.id, { text: withExtension(element.text, mark) });
                setExtensionsFor(null);
                setFocusId(element.id);
              }}
              onClose={() => {
                setExtensionsFor(null);
                setFocusId(element.id);
              }}
            />
          ) : null}
        </div>
      </Fragment>
    );
  };

  return (
    <div
      className={readOnly ? 'page-column reading' : 'page-column'}
      style={{ width: `${layout.columns}ch` }}
    >
      {/* The cue list is the beat's own: it is ordered for this beat. */}
      <datalist id={`cues-${beat.id}`}>
        {cues.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {items.map((item) => {
        // A page's worth of the beat, when the page view has divided it. Two
        // speeches printed side by side stay together, on the page their
        // first line falls on.
        const first = item.kind === 'element' ? item.index : (item.indexes[0] as number);
        if (only && !only.has(first)) return null;

        if (item.kind === 'element') return row(item.element, item.index, false);
        // Two speeches at once: side by side here, as they will be on the page.
        const split = item.indexes.slice(0, item.left.length);
        const rest = item.indexes.slice(item.left.length);
        return (
          <div className="dual-row" key={`dual-${item.left[0]?.id ?? rest[0]}`} style={dualStyle(layout)}>
            <div className="dual-column">{item.left.map((element, position) => row(element, split[position] as number, true))}</div>
            <div className="dual-column">{item.right.map((element, position) => row(element, rest[position] as number, true))}</div>
          </div>
        );
      })}

      {elements.length === 0 && emptyLabel && !readOnly ? (
        <button
          type="button"
          className="ghost add-element"
          onClick={() => {
            onActivate?.();
            insertAfter(-1, defaultElementType(format));
          }}
        >
          {emptyLabel}
        </button>
      ) : null}
    </div>
  );
}

const dualStyle = (layout: PageLayoutSpec): React.CSSProperties =>
  layout.dual
    ? ({ '--dual-width': `${layout.dual.width}ch`, '--dual-gap': `${layout.dual.gap}ch` } as React.CSSProperties)
    : {};

/**
 * The line's own characters, marks included, wearing their emphasis. The
 * capitals a cue or a slugline is printed in come from the stylesheet, which
 * dresses this and the box above it alike, so the two never drift apart.
 */
function Marked({ text }: { text: string }) {
  const spans = useMemo(() => parseInlineMarks(text), [text]);
  return (
    <>
      {spans.map((span, position) => (
        <Emphasis key={position} span={span} />
      ))}
      {/* A zero-width space keeps an empty line the height of a full one. */}
      {'​'}
    </>
  );
}

function Emphasis({ span }: { span: InlineSpan }) {
  let node: React.ReactNode = span.marker ? <span className="mark">{span.text}</span> : span.text;
  if (span.underline) node = <u>{node}</u>;
  if (span.italic) node = <i>{node}</i>;
  if (span.bold) node = <b>{node}</b>;
  return <>{node}</>;
}

/**
 * The extensions a cue can carry, grouped the way they are used and each
 * saying what it means — "(P.A.)" on its own tells nobody anything.
 */
function ExtensionMenu({ onPick, onClose }: { onPick(mark: string): void; onClose(): void }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.querySelector('button')?.focus();
  }, []);

  return (
    <div
      ref={panel}
      className="extension-menu"
      role="menu"
      aria-label="Extension"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      {EXTENSION_GROUPS.map((group) => {
        const marks = EXTENSIONS.filter((extension) => extension.group === group.id);
        if (marks.length === 0) return null;
        return (
          <Fragment key={group.id}>
            <h5>{group.label}</h5>
            {marks.map((extension) => (
              <button
                key={extension.mark}
                type="button"
                role="menuitem"
                className="extension-item"
                onClick={() => onPick(extension.mark)}
              >
                <span className="extension-mark">{extension.mark}</span>
                <span className="extension-term">{extension.term}</span>
                <span className="extension-what muted">{extension.what}</span>
              </button>
            ))}
          </Fragment>
        );
      })}
      <button type="button" role="menuitem" className="extension-item ghost" onClick={() => onPick('')}>
        <span className="extension-mark">—</span>
        <span className="extension-term">No extension</span>
      </button>
    </div>
  );
}
