import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  dictationKind,
  startDictation,
  systemDictationKey,
  type DictationSession,
} from '../dictation';
import {
  autoType,
  CHARACTER_EXTENSIONS,
  captureFromScript,
  EXTENSIONS,
  EXTENSION_GROUPS,
  carriesStructure,
  castNamesForBeat,
  cueSuggestions,
  notedCast,
  hasExtension,
  withExtension,
  cuesInOrder,
  defaultElementType,
  elementTypesFor,
  addSetupPayoff,
  addSetupPoint,
  groupManuscript,
  hasBookIndex,
  headingsSoFar,
  isDual,
  layoutForFile,
  markForIndex,
  newId,
  onEnter,
  onTab,
  peopleInBeat,
  readDictatedScript,
  recordPayoff,
  ref,
  retype,
  parseInlineMarks,
  reformatText,
  setDualDialogue,
  setupsBoard,
  styleShortcuts,
  subHeadingsUnder,
  toggleInline,
  updateBeat,
  type Beat,
  type BeatId,
  type CharacterId,
  type CharacterTraitId,
  type InlineMark,
  type InlineSpan,
  type ManuscriptElement,
  type ManuscriptElementId,
  type ManuscriptElementType,
  type PageLayoutSpec,
  type ProjectFile,
  type SetupPayoffId,
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
  /**
   * Whether to offer dictation here (spec §9).
   *
   * Off by default, and that is the whole of the reason it is a prop: the
   * Script draws every beat in the manuscript with one of these, so a control
   * rendered unconditionally appeared nine times down a short script, each
   * with its own copy of the spoken-command help. It belongs where **one**
   * beat is being written — the beat writer — and the Script says the key once
   * in its own footer instead.
   */
  dictation?: boolean;
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
  dictation = false,
}: BeatBodyProps) {
  const format = file.project.format;
  const layout = layoutForFile(file);
  const elementTypes = elementTypesFor(format);
  const shortcuts = useMemo(() => styleShortcuts(format), [format]);

  const [focusId, setFocusId] = useState<ManuscriptElementId | null>(null);
  const [selection, setSelection] = useState<{ id: ManuscriptElementId; start: number; end: number } | null>(null);
  const inputs = useRef(new Map<ManuscriptElementId, HTMLTextAreaElement>());

  /**
   * Right-clicked writing, waiting to be made into characterization (addendum
   * 08 §7). The passage is taken at the moment of the click, because the menu
   * takes focus off the line and the selection with it.
   */
  const [caught, setCaught] = useState<{
    x: number;
    y: number;
    elementId: ManuscriptElementId;
    text: string;
  } | null>(null);
  const [filing, setFiling] = useState<{ elementId: ManuscriptElementId; text: string } | null>(null);
  /** The same passage, on its way into the book's index (addendum 10 §6). */
  const [indexing, setIndexing] = useState<{ elementId: ManuscriptElementId; text: string } | null>(null);
  /** And on its way into a setup or a payoff (the Setups & Payoffs spec §4). */
  const [planting, setPlanting] = useState<{ text: string } | null>(null);

  /**
   * Dictation (spec §9), and *which* dictation depends on where this is
   * running — see `dictation.ts`. In Electron the recogniser is the operating
   * system's, so there is no session to hold and the button is a reminder of
   * the key; in the browser preview the page drives one itself.
   */
  const listening = useRef<DictationSession | null>(null);
  const [dictating, setDictating] = useState(false);
  const [heard, setHeard] = useState('');
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  /** Where dictated words are going: the line that had focus when it started. */
  const spokenInto = useRef<ManuscriptElementId | null>(null);
  const kind = dictationKind();

  // Nothing should still be listening after the writer has left the beat.
  useEffect(
    () => () => {
      listening.current?.stop();
      listening.current = null;
    },
    [],
  );

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
   * The manuscript as it stands *right now*.
   *
   * A recogniser's handlers are registered once, when listening starts, so
   * everything they close over is frozen at that render — and a writer speaks
   * more than one sentence. Reading through this rather than the captured
   * `elements` is what stops the second utterance overwriting the first.
   */
  const latest = useRef(elements);
  latest.current = elements;

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
    // Through `latest` rather than the captured list, because dictation reaches
    // here from handlers registered a render ago: mapping over the manuscript
    // as it was would drop every element spoken into being since.
    setElements(latest.current.map((element) => (element.id === id ? { ...element, ...patch } : element)));
  };

  const makeElement = (type: ManuscriptElementType): ManuscriptElement => ({
    id: newId<ManuscriptElementId>(),
    type,
    text: '',
    characterId: null,
    attributes: {},
  });

  const insertAfter = (index: number, type: ManuscriptElementType) => {
    // A new parenthetical arrives with its brackets, ready to be typed into.
    const made = retype('', type, type);
    const element = { ...makeElement(type), text: made.text };
    const next = [...elements];
    next.splice(index + 1, 0, element);
    setElements(next);
    if (made.text.length > 0) setSelection({ id: element.id, start: made.caret, end: made.caret });
    else setFocusId(element.id);
  };

  const removeAt = (index: number) => {
    const previous = elements[index - 1];
    setElements(elements.filter((_, position) => position !== index));
    if (previous) setFocusId(previous.id);
  };

  /**
   * A keystroke's verdict: a new line in that style, or this line re-typed.
   *
   * Re-typing carries the text across in the shape the new style wants it —
   * which for a parenthetical means inside its brackets, with the caret
   * between them, as Final Draft does it.
   */
  const applyTyping = (typing: Typing, element: ManuscriptElement, index: number) => {
    if (typing.newLine) {
      insertAfter(index, typing.type);
      return;
    }
    becomes(element, typing.type);
  };

  /** This line, re-typed as another style, with its punctuation put right. */
  const becomes = (element: ManuscriptElement, type: ManuscriptElementType) => {
    const made = retype(element.text, element.type, type);
    updateElement(element.id, made.text === element.text ? { type } : { type, text: made.text });
    setSelection({ id: element.id, start: made.caret, end: made.caret });
  };

  /** Text as it is typed, and the style the line turns out to be. */
  const writeText = (element: ManuscriptElement, text: string) => {
    // A line break that arrives *in* the text was never a keypress: the system's
    // dictation typing "new line" into the field, rather than Return, which is
    // handled on keydown and never fires here. Left alone it would bury a whole
    // scene inside one action paragraph, so it goes the way a paste goes.
    if (text.includes('\n')) {
      const index = latest.current.findIndex((one) => one.id === element.id);
      if (index >= 0 && layIn(element, index, text)) return;
    }

    const become = autoType(format, element.type, text, { detectShots });
    updateElement(element.id, become ? { text, type: become } : { text });
  };

  /** Dictated words added to the line being written, with a space between. */
  const join = (current: string, spoken: string): string => {
    const words = spoken.trim();
    if (words.length === 0) return current;
    if (current.length === 0) return words;
    return `${current}${current.endsWith(' ') ? '' : ' '}${words}`;
  };

  /**
   * Dictation becoming typed elements (spec §9).
   *
   * `readDictatedScript` in the domain decides what was said; this only lays it
   * out. The first run continues the line being written — dictation is mostly
   * words, not commands — and every style the writer names after that starts a
   * new element, so a scene spoken in one breath arrives as a slugline, action,
   * a cue and a speech rather than as one paragraph.
   *
   * Returns false when there was nothing structural in it, so the caller can
   * treat it as the ordinary edit it is.
   */
  const layIn = (element: ManuscriptElement, index: number, spoken: string): boolean => {
    if (!carriesStructure(spoken, format)) return false;

    const parts = readDictatedScript(spoken, format);
    if (parts.length === 0) return false;

    const next = [...latest.current];
    let at = index;
    let carry: ManuscriptElementType = element.type;
    let last: ManuscriptElementId = element.id;

    parts.forEach((part, position) => {
      const type = part.type ?? carry;
      carry = type;

      // The first run belongs to the line already open — either because it was
      // spoken straight into it, or because that line is empty and waiting for
      // whatever style was named.
      const continues = position === 0 && (!part.starts || element.text.trim().length === 0);

      if (continues) {
        const words = part.starts ? part.text : join(element.text, part.text);
        next[at] = { ...element, type, text: retype(words, element.type, type).text };
        return;
      }

      const made = { ...makeElement(type), text: retype(part.text, type, type).text };
      at += 1;
      next.splice(at, 0, made);
      last = made.id;
    });

    setElements(next);
    setFocusId(last);
    // Dictation carries on into the line it just made, not back into the one
    // the writer started from — otherwise the second half of a scene lands on
    // top of the first.
    spokenInto.current = last;
    return true;
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

  /**
   * Where dictated words land: the line the writer left the cursor in, or the
   * last line of the beat. Never a line chosen for them silently — if the beat
   * is empty, one is made first, so there is always somewhere visible for the
   * words to appear.
   */
  const speakingInto = (): { element: ManuscriptElement; index: number } | null => {
    const now = latest.current;
    const wanted = spokenInto.current;
    const at = wanted ? now.findIndex((one) => one.id === wanted) : -1;
    if (at >= 0) return { element: now[at] as ManuscriptElement, index: at };
    if (now.length === 0) return null;
    return { element: now[now.length - 1] as ManuscriptElement, index: now.length - 1 };
  };

  const hearWords = (spoken: string) => {
    const target = speakingInto();
    if (!target) return;
    if (layIn(target.element, target.index, spoken)) return;
    writeText(target.element, join(target.element.text, spoken));
  };

  const toggleDictation = () => {
    if (dictating) {
      listening.current?.stop();
      listening.current = null;
      setDictating(false);
      setHeard('');
      return;
    }

    // Somewhere for the words to go before any are heard.
    if (elements.length === 0) {
      insertAfter(-1, defaultElementType(format));
      setVoiceNote('Start again once the first line is there.');
      return;
    }

    const focused = [...inputs.current.entries()].find(([, node]) => node === document.activeElement);
    spokenInto.current = focused?.[0] ?? null;

    const started = startDictation({
      onFinal: (chunk) => {
        setHeard('');
        hearWords(chunk);
      },
      onInterim: setHeard,
      onError: (message) => {
        setVoiceNote(message);
        setDictating(false);
      },
      onEnd: () => {
        setHeard('');
        setDictating(false);
      },
    });

    if (!started) {
      setVoiceNote(`No speech service in this build — ${systemDictationKey()} and dictate into the line.`);
      return;
    }
    listening.current = started;
    setVoiceNote(null);
    setDictating(true);
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
      becomes(element, shortcuts[event.key] as ManuscriptElementType);
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
    // A prose paragraph's five spaces belong to its opening line only (§6.4).
    const firstIndent = dual ? 0 : layout.firstIndent?.[element.type] ?? 0;
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
          style={
            {
              '--indent': `${indent}ch`,
              '--width': `${width}ch`,
              '--first-indent': `${firstIndent}ch`,
            } as React.CSSProperties
          }
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
                // A parenthetical left half-open closes itself. Done on the way
                // out rather than on every keystroke, so deleting the bracket
                // to retype the line is not fought character by character.
                if (element.type === 'parenthetical') {
                  const closed = retype(element.text, 'parenthetical', 'parenthetical').text;
                  if (closed !== element.text) updateElement(element.id, { text: closed });
                  return;
                }
                if (element.type !== 'character' || element.text.trim().length === 0) return;
                onUpdate((current) => notedCast(current));
              }}
              onChange={(event) => writeText(element, event.target.value)}
              onPaste={(event) => handlePaste(event, element, index)}
              onKeyDown={(event) => handleKeyDown(event, element, index)}
              // Story → plan (addendum 08 §7): right-click the writing and it
              // becomes characterization, without leaving the page. The
              // selection is read here because opening the menu loses it.
              onContextMenu={(event) => {
                if (readOnly) return;
                const input = event.currentTarget;
                const picked = input.value.slice(input.selectionStart, input.selectionEnd).trim();
                const text = picked.length > 0 ? picked : element.text.trim();
                if (text.length === 0) return;
                event.preventDefault();
                setCaught({ x: event.clientX, y: event.clientY, elementId: element.id, text });
              }}
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

      {/* Dictation (spec §9). The button is offered until a session proves
          there is no speech service behind it, after which the system's own
          dictation is named instead — see `dictation.ts` for why this is
          settled by trying rather than by guessing the platform. */}
      {dictation && !readOnly ? (
        <div className="dictation">
          {kind === 'offer' ? (
            <button
              type="button"
              className={dictating ? 'ghost small listening' : 'ghost small'}
              aria-pressed={dictating}
              onClick={toggleDictation}
            >
              {dictating ? '● Listening — click to stop' : 'Dictate'}
            </button>
          ) : (
            <span className="muted small">
              To dictate, put the cursor in a line and {systemDictationKey()}.
            </span>
          )}

          {kind === 'offer' ? (
            <span className="muted small">
              Say <strong>Scene heading</strong>, <strong>Action</strong>, <strong>Character</strong>,{' '}
              <strong>Dialogue</strong> or <strong>Parenthetical</strong> — as a sentence of its own — to
              start that kind of line.
            </span>
          ) : (
            /* Naming a style aloud cannot work on this path, and implying it
               could would be worse than saying nothing: the system types into
               the field, and the app has no way to tell those words from the
               same words typed by hand — so it must not act on them. Saying
               "new line" does reach it, a line break in a field never having
               been a keypress, and that is what is offered. */
            <span className="muted small">
              Say <strong>new line</strong> to start the next element; <strong>Tab</strong> changes what kind
              it is.
            </span>
          )}

          {heard.length > 0 ? <span className="dictation-heard">{heard}</span> : null}
          {voiceNote ? <span className="error small">{voiceNote}</span> : null}
        </div>
      ) : null}

      {caught ? (
        <CaughtMenu
          x={caught.x}
          y={caught.y}
          onPick={() => {
            setFiling({ elementId: caught.elementId, text: caught.text });
            setCaught(null);
          }}
          // An index is a book's, so a screenplay is never offered one
          // (addendum 10 §2): a stack of scripts each numbering from its own
          // page one has no single page 34 for an entry to point at.
          onIndex={
            hasBookIndex(file.project.format)
              ? () => {
                  setIndexing({ elementId: caught.elementId, text: caught.text });
                  setCaught(null);
                }
              : null
          }
          onPlant={
            readOnly
              ? null
              : () => {
                  setPlanting({ text: caught.text });
                  setCaught(null);
                }
          }
          onClose={() => setCaught(null)}
        />
      ) : null}

      {filing ? (
        <FileAsCharacterization
          file={file}
          beat={beat}
          elementId={filing.elementId}
          passage={filing.text}
          onUpdate={onUpdate}
          onClose={() => setFiling(null)}
        />
      ) : null}

      {indexing ? (
        <FileInIndex
          file={file}
          beatId={beat.id}
          elementId={indexing.elementId}
          passage={indexing.text}
          onUpdate={onUpdate}
          onClose={() => setIndexing(null)}
        />
      ) : null}

      {planting ? (
        <PlantSetupOrPayoff
          file={file}
          beatId={beat.id}
          passage={planting.text}
          onUpdate={onUpdate}
          onClose={() => setPlanting(null)}
        />
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

/**
 * The menu the right-click opens on a line of the manuscript.
 *
 * Electron gives a renderer no context menu of its own, so nothing is being
 * taken away here, and a menu that grew Cut/Copy/Paste would be reimplementing
 * the platform badly. What joins the list is only ever *filing this passage
 * somewhere* — which is what a right-click on writing is for.
 *
 * The index item is absent rather than disabled on a screenplay: a greyed line
 * says *you cannot do this yet*, and the true thing is that this format has no
 * index at all.
 */
function CaughtMenu({
  x,
  y,
  onPick,
  onIndex,
  onPlant,
  onClose,
}: {
  x: number;
  y: number;
  onPick(): void;
  onIndex: (() => void) | null;
  onPlant: (() => void) | null;
  onClose(): void;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.querySelector('button')?.focus();
    const away = () => onClose();
    // Any click elsewhere, and any scroll, closes it: a menu pinned to a
    // position on screen is wrong the moment the page moves under it.
    window.addEventListener('pointerdown', away);
    window.addEventListener('scroll', away, true);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('scroll', away, true);
    };
  }, [onClose]);

  return (
    <div
      ref={panel}
      className="caught-menu"
      role="menu"
      aria-label="What to do with this writing"
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <button type="button" role="menuitem" className="caught-item" onClick={onPick}>
        Add to a character’s characterization…
      </button>
      {onIndex ? (
        <button type="button" role="menuitem" className="caught-item" onClick={onIndex}>
          Index this…
        </button>
      ) : null}
      {onPlant ? (
        <button type="button" role="menuitem" className="caught-item" onClick={onPlant}>
          Make this a setup or a payoff…
        </button>
      ) : null}
    </div>
  );
}

/**
 * Turning a passage into characterization without leaving the page (addendum 08
 * §7, stage 4).
 *
 * **Nothing here is a decision the writer has to make twice.** The people who
 * speak in the beat come first in the list, the trait can be named rather than
 * chosen, and the passage arrives already in the box and editable — because what
 * a writer wants to file is usually a *reading* of the line rather than the line
 * itself: *leaves a small tip* from *she counts out four coins*.
 *
 * What comes out is green immediately: `captureFromScript` makes the item and
 * pins it here in one go, so the writer is never asked to go and say where the
 * thing they were just looking at was.
 */
function FileAsCharacterization({
  file,
  beat,
  elementId,
  passage,
  onUpdate,
  onClose,
}: {
  file: ProjectFile;
  beat: Beat;
  elementId: ManuscriptElementId;
  passage: string;
  onUpdate: BeatBodyProps['onUpdate'];
  onClose(): void;
}) {
  const here = useMemo(() => new Set(peopleInBeat(file, beat.id).map((id) => id as string)), [file, beat.id]);
  const cast = useMemo(
    () =>
      file.characters
        .filter((person) => !person.archived)
        // Whoever speaks in this beat first: a guess about what is likely, and
        // never a filter, since a beat can characterize somebody silent in it.
        .sort((a, b) => Number(here.has(b.id as string)) - Number(here.has(a.id as string))),
    [file.characters, here],
  );

  const [characterId, setCharacterId] = useState<CharacterId | ''>(cast[0]?.id ?? '');
  const [traitId, setTraitId] = useState<string>('');
  const [newTrait, setNewTrait] = useState('');
  const [text, setText] = useState(passage);

  const traits = file.characterTraits.filter(
    (trait) => (trait.characterId as string) === (characterId as string) && !trait.archived,
  );

  const save = () => {
    if (characterId === '' || text.trim().length === 0) return;
    onUpdate((current) =>
      captureFromScript(current, {
        characterId,
        traitId: traitId === '' ? null : (traitId as CharacterTraitId),
        ...(traitId === '' && newTrait.trim().length > 0 ? { newTraitName: newTrait.trim() } : {}),
        text,
        beatId: beat.id,
        elementId,
      }).file,
    );
    onClose();
  };

  if (cast.length === 0) {
    return (
      <div className="caught-dialog" role="dialog" aria-label="Add to characterization">
        <p className="muted small">Nobody is in the cast yet — add a character and this has somewhere to go.</p>
        <div className="caught-actions">
          <button type="button" className="ghost small" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="caught-dialog"
      role="dialog"
      aria-label="Add to characterization"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <label className="field">
        <span>Who this shows</span>
        <select
          autoFocus
          aria-label="Character"
          value={characterId as string}
          onChange={(event) => {
            setCharacterId(event.target.value as CharacterId);
            setTraitId('');
          }}
        >
          {cast.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
              {here.has(person.id as string) ? ' — in this beat' : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>What it is an example of</span>
        <select aria-label="Trait" value={traitId} onChange={(event) => setTraitId(event.target.value)}>
          <option value="">Not filed yet</option>
          {traits.map((trait) => (
            <option key={trait.id} value={trait.id}>
              {trait.name}
            </option>
          ))}
        </select>
      </label>

      {/* Naming a new trait here is §7's requirement: the fast path must not
          stop to send somebody off to make a folder first. */}
      {traitId === '' ? (
        <label className="field">
          <span>Or name a new trait</span>
          <input
            aria-label="New trait"
            placeholder="Greedy, never asks for help"
            value={newTrait}
            onChange={(event) => setNewTrait(event.target.value)}
          />
        </label>
      ) : null}

      <label className="field">
        <span>How it shows — in your words</span>
        <textarea
          aria-label="How it shows"
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>

      <p className="muted small">
        The line stays as it is. This goes in green, pinned here.
      </p>

      <div className="caught-actions">
        <button type="button" className="ghost small" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="ghost small" disabled={text.trim().length === 0} onClick={save}>
          Add it
        </button>
      </div>
    </div>
  );
}

/**
 * Filing a passage in the book's index, from the writing (addendum 10 §6).
 *
 * The same right-click as the Character Creator's and deliberately the same
 * shape, because it is the same act — *this passage is about that* — pointed at
 * the back of the book instead of at a person.
 *
 * Two things differ, and both are the module's rules arriving in the interface.
 * **The heading is the writer's words and never the passage's**, so the box
 * starts empty rather than pre-filled with the line: an index whose headings
 * were the sentences they came from would be a concordance. And **the passage
 * is shown rather than offered for editing** — the Character Creator lets it be
 * rewritten because what is filed there is the writer's *reading* of the line,
 * while a quote here is what the page said, kept for recognising the mark later
 * and for nothing else.
 *
 * No page number is asked for and none is shown, because there is none to
 * store: where this lands is worked out from the pagination every time, and the
 * line under the buttons says so — a writer expecting to type a number should
 * find out here rather than wonder later why nothing asked.
 */
function FileInIndex({
  file,
  beatId,
  elementId,
  passage,
  onUpdate,
  onClose,
}: {
  file: ProjectFile;
  beatId: BeatId;
  elementId: ManuscriptElementId;
  passage: string;
  onUpdate: BeatBodyProps['onUpdate'];
  onClose(): void;
}) {
  const [term, setTerm] = useState('');
  const [subTerm, setSubTerm] = useState('');
  const [principal, setPrincipal] = useState(false);

  const headings = useMemo(() => headingsSoFar(file), [file]);
  // The sub-headings of whatever heading is being typed — which is empty until
  // the heading is one the book already has, and that is the honest answer.
  const subs = useMemo(() => (term.trim().length > 0 ? subHeadingsUnder(file, term) : []), [file, term]);

  const save = () => {
    if (term.trim().length === 0) return;
    onUpdate(
      (current) =>
        markForIndex(current, {
          term,
          subTerm,
          beatId,
          elementId,
          // What the page said when it was marked. For reading, never for
          // finding — the mark is anchored to the element, not to these words.
          quote: passage,
          principal,
        }).file,
    );
    onClose();
  };

  return (
    <div
      className="caught-dialog"
      role="dialog"
      aria-label="Index this passage"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <label className="field">
        <span>Index it under</span>
        <input
          autoFocus
          aria-label="Heading"
          list="vcwriter-index-headings"
          placeholder="lamp, the"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              save();
            }
          }}
        />
      </label>
      <datalist id="vcwriter-index-headings">
        {headings.map((heading) => (
          <option key={heading} value={heading} />
        ))}
      </datalist>

      <label className="field">
        <span>Under a sub-heading (optional)</span>
        <input
          aria-label="Sub-heading"
          list="vcwriter-index-subheadings"
          placeholder="cleaning of"
          value={subTerm}
          onChange={(event) => setSubTerm(event.target.value)}
        />
      </label>
      <datalist id="vcwriter-index-subheadings">
        {subs.map((sub) => (
          <option key={sub} value={sub} />
        ))}
      </datalist>

      <label className="check">
        <input
          type="checkbox"
          checked={principal}
          onChange={(event) => setPrincipal(event.target.checked)}
        />
        <span>This is the principal discussion — set bold in the index</span>
      </label>

      <p className="index-quote">{passage}</p>

      <p className="muted small">
        The page number is worked out when the book is laid out, and follows the
        writing on its own.
      </p>

      <div className="caught-actions">
        <button type="button" className="ghost small" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="ghost small" disabled={term.trim().length === 0} onClick={save}>
          Index it
        </button>
      </div>
    </div>
  );
}

/**
 * Making a passage a setup point or the payoff, from the writing (the Setups &
 * Payoffs spec §4).
 *
 * The third thing the right-click can do, and the same shape as the other two
 * on purpose: *this passage is that*, pointed at a promise the story has made
 * rather than at a person or an index heading.
 *
 * **Which of the two it is, is the only question that matters here**, so it is
 * the control with the largest type. Everything else — where it landed, whether
 * it counts, how many the payoff still wants — is worked out afterwards from
 * the story order and shown in the Research panel, because none of it is
 * something a writer in the middle of a scene should have to answer.
 *
 * A payoff can be named before any of its setups are written, so the record
 * list includes every active record and a way to start a new one without
 * leaving the page.
 */
function PlantSetupOrPayoff({
  file,
  beatId,
  passage,
  onUpdate,
  onClose,
}: {
  file: ProjectFile;
  beatId: BeatId;
  passage: string;
  onUpdate: BeatBodyProps['onUpdate'];
  onClose(): void;
}) {
  const records = useMemo(
    () => setupsBoard(file).map((row) => ({ record: row.record, readiness: row.readiness })),
    [file],
  );
  const [recordId, setRecordId] = useState<SetupPayoffId | ''>(records[0]?.record.id ?? '');
  const [newTitle, setNewTitle] = useState('');
  const [kind, setKind] = useState<'setup' | 'payoff'>('setup');
  const [note, setNote] = useState('');

  const chosen = records.find((row) => (row.record.id as string) === (recordId as string)) ?? null;

  const save = () => {
    const title = newTitle.trim();
    if (recordId === '' && title.length === 0) return;
    onUpdate((current) => {
      // A record named here is made first, so the point has somewhere to go —
      // and the whole act is one update, so a failure leaves neither behind.
      let next = current;
      let target = recordId as SetupPayoffId | '';
      if (target === '') {
        next = addSetupPayoff(next, { title, description: '' });
        target = next.setupsPayoffs[next.setupsPayoffs.length - 1]!.id;
      }
      const description = note.trim().length > 0 ? note.trim() : passage;
      return kind === 'setup'
        ? addSetupPoint(next, {
            setupPayoffId: target,
            description,
            location: ref('beat', beatId as string),
            strength: 'written',
            excerpt: passage,
          })
        : recordPayoff(next, {
            setupPayoffId: target,
            description,
            location: ref('beat', beatId as string),
            excerpt: passage,
          });
    });
    onClose();
  };

  return (
    <div
      className="caught-dialog"
      role="dialog"
      aria-label="Make this a setup or a payoff"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="plant-kind" role="radiogroup" aria-label="What this passage is">
        {(['setup', 'payoff'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={kind === option}
            className={kind === option ? 'plant-choice on' : 'plant-choice'}
            onClick={() => setKind(option)}
          >
            {option === 'setup' ? 'A setup point' : 'The payoff'}
          </button>
        ))}
      </div>

      <label className="field">
        <span>For which payoff</span>
        <select
          autoFocus
          aria-label="Payoff"
          value={recordId as string}
          onChange={(event) => setRecordId(event.target.value as SetupPayoffId | '')}
        >
          {records.map((row) => (
            <option key={row.record.id} value={row.record.id}>
              {row.record.title} — {row.readiness.count}
            </option>
          ))}
          <option value="">Something new…</option>
        </select>
      </label>

      {/* Naming a new payoff here is the same requirement §7 has elsewhere: the
          fast path must not stop to send somebody off to make a record first. */}
      {recordId === '' ? (
        <label className="field">
          <span>What has to land</span>
          <input
            aria-label="New payoff"
            placeholder="The gun in the drawer fires"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
          />
        </label>
      ) : null}

      <label className="field">
        <span>What this one does — in your words</span>
        <input
          aria-label="What this point does"
          placeholder={kind === 'setup' ? 'She notices the drawer is locked' : 'She fires it'}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <p className="index-quote">{passage}</p>

      <p className="muted small">
        {chosen && kind === 'setup'
          ? `${chosen.readiness.says} Whether this one counts depends on where it falls against the payoff.`
          : 'Only setups that fall before the payoff count towards it.'}
      </p>

      <div className="caught-actions">
        <button type="button" className="ghost small" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="ghost small"
          disabled={recordId === '' && newTitle.trim().length === 0}
          onClick={save}
        >
          {kind === 'setup' ? 'Plant it' : 'Pay it off'}
        </button>
      </div>
    </div>
  );
}
