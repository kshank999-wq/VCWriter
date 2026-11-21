import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { PAGE_NUMBER_PRESETS, PAPER_SIZES, type DocumentPageSetup, type PageNumberPreset, type PaperSize } from '@vcwriter/domain';
import { useFontLibrary } from './fonts';
import { NO_FILL, SHAPES, SHAPE_FILLS, insertShape, shapeSvg, type ShapeId } from './shapes';
import type { DocumentSpeech } from './speech';
import { Chevron, HighlightIcon, ICONS, InkIcon } from './icons';

/**
 * **The ribbon** (addendum 42 §3): Word's tabs of grouped controls, over the
 * page.
 *
 * Every control does something. The spec's rule (§14) is that a feature the
 * editor cannot do is left off rather than shown greyed, so footnotes,
 * comments and tracked changes have no buttons here yet. The addendum lists
 * them as follow-on work.
 *
 * Buttons take the press on mouse-down and refuse focus, which keeps the
 * selection in the page. That is how Word behaves, and it is what lets a
 * writer select a word and press Bold without the word being deselected.
 */

export type RibbonTab = 'file' | 'home' | 'insert' | 'layout' | 'references' | 'review' | 'view';

const TABS: { id: RibbonTab; label: string }[] = [
  { id: 'file', label: 'File' },
  { id: 'home', label: 'Home' },
  { id: 'insert', label: 'Insert' },
  { id: 'layout', label: 'Layout' },
  { id: 'references', label: 'References' },
  { id: 'review', label: 'Review' },
  { id: 'view', label: 'View' },
];

export const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

/** The font list's last line: list every face this computer has. */
const MORE_FONTS = '__more-fonts';

const INKS = ['#000000', '#404040', '#7f7f7f', '#c00000', '#ff0000', '#ffc000', '#00b050', '#0070c0', '#002060', '#7030a0'];
const HIGHLIGHTS = ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffc0cb', '#d9d9d9'];

const SYMBOLS = ['©', '®', '™', '§', '¶', '†', '‡', '•', '…', '—', '–', '°', '±', '×', '÷', '≈', '≠', '≤', '≥', '€', '£', '¥', '¢', '½', '¼', '¾', '→', '←', '✓'];

export const STYLES: { id: string; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'title', label: 'Title' },
  { id: 'subtitle', label: 'Subtitle' },
  { id: 'h1', label: 'Heading 1' },
  { id: 'h2', label: 'Heading 2' },
  { id: 'h3', label: 'Heading 3' },
  { id: 'h4', label: 'Heading 4' },
  { id: 'h5', label: 'Heading 5' },
  { id: 'h6', label: 'Heading 6' },
  { id: 'quote', label: 'Quote' },
];

/** Which style the paragraph under the cursor is in, as the gallery names it. */
export const currentStyle = (editor: Editor): string => {
  for (let level = 1; level <= 6; level += 1) {
    if (editor.isActive('heading', { level })) return `h${level}`;
  }
  if (editor.isActive('blockquote')) return 'quote';
  const docStyle = editor.getAttributes('paragraph')['docStyle'];
  return docStyle === 'title' || docStyle === 'subtitle' ? docStyle : 'normal';
};

export const applyStyle = (editor: Editor, style: string): void => {
  const chain = editor.chain().focus();
  // Out of a quote first, so a quote can become a heading and back.
  const base = editor.isActive('blockquote') ? chain.lift('blockquote') : chain;
  if (style.startsWith('h')) {
    base.setHeading({ level: Number(style.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  } else if (style === 'quote') {
    base.setParagraph().updateAttributes('paragraph', { docStyle: null }).setBlockquote().run();
  } else {
    base.setDocStyle(style === 'title' || style === 'subtitle' ? style : null).run();
  }
};

const MARGIN_PRESETS: { label: string; margins: DocumentPageSetup['margins'] }[] = [
  { label: 'Normal (1 in)', margins: { top: 1, right: 1, bottom: 1, left: 1 } },
  { label: 'Narrow (0.5 in)', margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } },
  { label: 'Moderate', margins: { top: 1, right: 0.75, bottom: 1, left: 0.75 } },
  { label: 'Wide', margins: { top: 1, right: 2, bottom: 1, left: 2 } },
];

export interface FileActions {
  save(): void;
  saveAs(): void;
  print(): void;
  exportPdf(): void;
  exportDocx(): void;
  exportText(): void;
  insertFile(file: File): void;
}

export interface ViewState {
  layout: 'print' | 'web';
  navigation: boolean;
  marks: boolean;
  spelling: boolean;
  zoom: number;
  /** Zoom that follows the window: the whole page, or its width (addendum 42 §15). */
  fit: 'none' | 'page' | 'width';
}

interface RibbonProps {
  editor: Editor;
  tab: RibbonTab;
  onTab(tab: RibbonTab): void;
  pageSetup: DocumentPageSetup;
  onPageSetup(patch: Partial<Omit<DocumentPageSetup, 'margins'>> & { margins?: Partial<DocumentPageSetup['margins']> }): void;
  file: FileActions;
  view: ViewState;
  onView(patch: Partial<ViewState>): void;
  onFind(mode: 'find' | 'replace'): void;
  painting: boolean;
  onPaint(): void;
  words: number;
  characters: number;
  /** Headers, footers and page numbers (addendum 42 §15). */
  headerFooter: {
    open: boolean;
    onToggle(): void;
    pageNumbers: PageNumberPreset | 'none' | 'custom';
    onPageNumbers(preset: PageNumberPreset | 'none'): void;
  };
  speech: DocumentSpeech;
  /** Citations and the library (addendum 43 §11), as Word's References tab has them. */
  references: {
    /** The style the project cites in, in words. */
    style: string;
    /** How many places this document cites, and how many sources the library has. */
    cited: number;
    library: number;
    onCite(): void;
    onBibliography(): void;
    onLibrary(): void;
    onBringIn(): void;
    /** A table of contents at the cursor (addendum 42 §19). */
    onContents(): void;
    /** The writer's own notes (addendum 42 §18). */
    onFootnote(): void;
    onEndnote(): void;
  };
  /** Tracked changes (addendum 42 §21). */
  changes: {
    tracking: boolean;
    count: number;
    onTrack(): void;
    onAccept(): void;
    onReject(): void;
    onAcceptAll(): void;
    onRejectAll(): void;
    onPrevious(): void;
    onNext(): void;
  };
  /** Comments (addendum 42 §20). */
  comments: {
    /** Open (unresolved) comments. */
    count: number;
    shown: boolean;
    onNew(): void;
    onPrevious(): void;
    onNext(): void;
    onShow(): void;
  };
  /** A line for the writer, where something did not work. */
  onSay(message: string): void;
}

type TabProps = RibbonProps & { fonts: ReturnType<typeof useFontLibrary> };

/** A ribbon button: pressed on mouse-down so the page keeps its selection. */
function Tool({
  label,
  title,
  active,
  disabled,
  onPress,
  children,
  wide,
  big,
}: {
  label: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  onPress(): void;
  children?: ReactNode;
  wide?: boolean;
  /** Word's large buttons: the picture over its name. */
  big?: boolean;
}) {
  return (
    <button
      type="button"
      className={`wp-tool${active ? ' active' : ''}${wide ? ' wide' : ''}${big ? ' big' : ''}`}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={title ?? label}
      disabled={disabled}
      tabIndex={-1}
      onMouseDown={(event) => {
        event.preventDefault();
        if (!disabled) onPress();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (!disabled) onPress();
        }
      }}
    >
      {children ?? label}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="wp-group" role="group" aria-label={label}>
      <div className="wp-group-tools">{children}</div>
      <div className="wp-group-label">{label}</div>
    </div>
  );
}

export function Ribbon(ribbon: RibbonProps) {
  const { editor, tab, onTab } = ribbon;
  // Here rather than in the Home tab, so the computer's fonts, once listed, stay listed across tabs.
  const fonts = useFontLibrary();
  const props: TabProps = { ...ribbon, fonts };
  return (
    <div className="wp-ribbon">
      <div className="wp-tabs" role="tablist" aria-label="Ribbon">
        {TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab === one.id}
            className={`wp-tab${tab === one.id ? ' active' : ''}`}
            onClick={() => onTab(one.id)}
          >
            {one.label}
          </button>
        ))}
      </div>
      <div className="wp-panel" role="tabpanel" aria-label={TABS.find((one) => one.id === tab)?.label}>
        {tab === 'file' ? <FileTab {...props} /> : null}
        {tab === 'home' ? <HomeTab {...props} editor={editor} /> : null}
        {tab === 'insert' ? <InsertTab {...props} /> : null}
        {tab === 'layout' ? <LayoutTab {...props} /> : null}
        {tab === 'references' ? <ReferencesTab {...props} /> : null}
        {tab === 'review' ? <ReviewTab {...props} /> : null}
        {tab === 'view' ? <ViewTab {...props} /> : null}
      </div>
    </div>
  );
}

function FileTab({ file }: TabProps) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <>
      <Group label="Save">
        <Tool label="Save" title="Save (Ctrl+S)" onPress={file.save} wide />
        <Tool label="Save as…" onPress={file.saveAs} wide />
      </Group>
      <Group label="Print">
        <Tool label="Print…" title="Print (Ctrl+P)" onPress={file.print} wide />
      </Group>
      <Group label="Export">
        <Tool label="Word (.docx)" onPress={file.exportDocx} wide />
        <Tool label="PDF" onPress={file.exportPdf} wide />
        <Tool label="Plain text" onPress={file.exportText} wide />
      </Group>
      <Group label="Bring in">
        <Tool label="Insert a file…" title="Insert a Word or text file at the cursor" onPress={() => picker.current?.click()} wide />
        <input
          ref={picker}
          type="file"
          accept=".docx,.txt,.md,.text"
          hidden
          aria-label="Choose a Word or text file to insert"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            event.target.value = '';
            if (chosen) file.insertFile(chosen);
          }}
        />
      </Group>
    </>
  );
}

/** Word's Change Case. */
type Case = 'sentence' | 'lower' | 'upper' | 'title' | 'toggle';
const CASES: { id: Case; label: string }[] = [
  { id: 'sentence', label: 'Sentence case.' },
  { id: 'lower', label: 'lowercase' },
  { id: 'upper', label: 'UPPERCASE' },
  { id: 'title', label: 'Capitalize Each Word' },
  { id: 'toggle', label: 'tOGGLE cASE' },
];

const recase = (text: string, how: Case, startsSentence: boolean): string => {
  switch (how) {
    case 'lower':
      return text.toLowerCase();
    case 'upper':
      return text.toUpperCase();
    case 'title':
      return text.toLowerCase().replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
    case 'toggle':
      return [...text].map((one) => (one === one.toUpperCase() ? one.toLowerCase() : one.toUpperCase())).join('');
    case 'sentence': {
      let start = startsSentence;
      return [...text.toLowerCase()]
        .map((one) => {
          if (start && /\p{L}/u.test(one)) {
            start = false;
            return one.toUpperCase();
          }
          if (/[.!?]/.test(one)) start = true;
          return one;
        })
        .join('');
    }
  }
};

/**
 * **Change case** over the selection, keeping every word's formatting: each
 * run of text is re-cased where it stands, last first so positions hold.
 */
export const changeCase = (editor: Editor, how: Case): void => {
  const { from, to, empty } = editor.state.selection;
  if (empty) return;
  const runs: { from: number; to: number; text: string; marks: readonly import('@tiptap/pm/model').Mark[] }[] = [];
  editor.state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return;
    const a = Math.max(from, pos);
    const b = Math.min(to, pos + node.text.length);
    if (a < b) runs.push({ from: a, to: b, text: node.text.slice(a - pos, b - pos), marks: node.marks });
  });
  const before = editor.state.doc.textBetween(Math.max(0, from - 3), from, '\n', ' ');
  const tr = editor.state.tr;
  let startsSentence = from <= 1 || /(^|[.!?]\s*|\n\s*)$/.test(before) || before.trim() === '';
  const recased = runs.map((run) => {
    const text = recase(run.text, how, startsSentence);
    startsSentence = /[.!?]\s*$/.test(run.text) || (startsSentence && !/\p{L}/u.test(run.text));
    return { ...run, text };
  });
  for (const run of [...recased].reverse()) {
    tr.replaceWith(run.from, run.to, editor.schema.text(run.text, run.marks));
  }
  editor.view.dispatch(tr);
  editor.commands.focus();
};

/** Word's Sort: the selected paragraphs, A to Z by their words. Nothing changes for fewer than two. */
export const sortParagraphs = (editor: Editor, descending = false): boolean => {
  const { from, to } = editor.state.selection;
  const doc = editor.state.doc;
  const blocks: { node: import('@tiptap/pm/model').Node; pos: number }[] = [];
  doc.forEach((node, pos) => {
    if (pos + node.nodeSize > from && pos < to && node.type.name === 'paragraph') blocks.push({ node, pos });
  });
  if (blocks.length < 2) return false;
  // Only a run of paragraphs side by side is sorted; anything else in between is left alone.
  const first = blocks[0]!.pos;
  const last = blocks[blocks.length - 1]!;
  let expected = first;
  for (const one of blocks) {
    if (one.pos !== expected) return false;
    expected = one.pos + one.node.nodeSize;
  }
  const sorted = [...blocks]
    .map((one) => one.node)
    .sort((a, b) => a.textContent.localeCompare(b.textContent, undefined, { sensitivity: 'base', numeric: true }) * (descending ? -1 : 1));
  editor.view.dispatch(editor.state.tr.replaceWith(first, last.pos + last.node.nodeSize, sorted));
  editor.commands.focus();
  return true;
};

/**
 * A button with a menu under it — Word's split buttons (the colour under the
 * A, the list kinds beside Numbering). With `onPress` the face does the
 * last-used thing and the arrow opens the menu; without, the whole button
 * opens it. Pressed on mouse-down, like every ribbon tool, so the page keeps
 * its selection.
 */
function Drop({
  label,
  title,
  face,
  onPress,
  active,
  big,
  caption,
  children,
}: {
  label: string;
  title?: string;
  face: ReactNode;
  onPress?(): void;
  active?: boolean;
  big?: boolean;
  caption?: string;
  children(close: () => void): ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // The menu is placed against the window, not the ribbon, so it drops over the page as Word's do instead of being cut off at the ribbon's edge.
  useEffect(() => {
    if (!open || !box.current) return;
    const rect = box.current.getBoundingClientRect();
    setAt({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 240) });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    const shut = () => setOpen(false);
    window.addEventListener('mousedown', away);
    window.addEventListener('keydown', escape);
    window.addEventListener('resize', shut);
    return () => {
      window.removeEventListener('mousedown', away);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('resize', shut);
    };
  }, [open]);
  const press = (action: () => void) => (event: { preventDefault(): void }) => {
    event.preventDefault();
    action();
  };
  return (
    <div className={`wp-drop${big ? ' big' : ''}${onPress ? ' split' : ''}${open ? ' open' : ''}`} ref={box}>
      {onPress ? (
        <button type="button" className={`wp-tool wp-drop-face${active ? ' active' : ''}`} aria-label={label} title={title ?? label} tabIndex={-1} onMouseDown={press(onPress)}>
          {face}
          {big && caption ? <span className="wp-caption">{caption}</span> : null}
        </button>
      ) : null}
      <button
        type="button"
        className={`wp-tool wp-drop-arrow${!onPress && active ? ' active' : ''}`}
        aria-label={onPress ? `${label} options` : label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={onPress ? `${label}: more` : (title ?? label)}
        tabIndex={-1}
        onMouseDown={press(() => setOpen((was) => !was))}
      >
        {onPress ? null : face}
        {!onPress && big && caption ? <span className="wp-caption">{caption}</span> : null}
        <Chevron />
      </button>
      {open ? (
        <div
          className="wp-menu"
          role="menu"
          aria-label={label}
          style={at ? { position: 'fixed', top: at.top, left: at.left } : { visibility: 'hidden' }}
          onMouseDown={(event) => event.preventDefault()}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ label, onPick, active, children }: { label: string; onPick(): void; active?: boolean; children?: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`wp-menu-item${active ? ' active' : ''}`}
      tabIndex={-1}
      onMouseDown={(event) => {
        event.preventDefault();
        onPick();
      }}
    >
      {children ?? label}
    </button>
  );
}

/** A colour grid for a menu, and the way back to none. */
function Palette({ colours, onPick, none, onNone, close }: { colours: string[]; onPick(colour: string): void; none: string; onNone(): void; close(): void }) {
  return (
    <>
      <div className="wp-palette">
        {colours.map((colour) => (
          <button
            key={colour}
            type="button"
            className="wp-swatch"
            style={{ background: colour }}
            aria-label={colour}
            title={colour}
            tabIndex={-1}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(colour);
              close();
            }}
          />
        ))}
      </div>
      <MenuItem
        label={none}
        onPick={() => {
          onNone();
          close();
        }}
      />
    </>
  );
}

const STYLE_TILES = ['normal', 'title', 'h1', 'h2', 'h3', 'quote'];

/**
 * **Home**, laid out as Word lays it out (from Ken, 21 November: *I want the
 * tool bar to look similar to MS Word so it is familiar with the same
 * functions*): Clipboard, Font, Paragraph, Styles, Editing, Voice — the same
 * groups in the same order, the same pictures, two rows of small tools and a
 * big one where Word has a big one.
 */
function HomeTab({ editor, onFind, painting, onPaint, fonts, onSay, view, onView, speech }: TabProps) {
  const style = editor.getAttributes('textStyle');
  const family = typeof style['fontFamily'] === 'string' ? String(style['fontFamily']).split(',')[0]?.replace(/["']/g, '').trim() : '';
  const size = typeof style['fontSize'] === 'string' ? String(style['fontSize']).replace(/pt$/, '') : '';
  const chain = () => editor.chain().focus();
  const listType = editor.getAttributes('orderedList')['type'];
  const [ink, setInk] = useState('#c00000');
  const [marker, setMarker] = useState('#ffff00');
  const block = editor.isActive('heading') ? 'heading' : 'paragraph';
  const lineHeight = editor.getAttributes(block)['lineHeight'];
  const spaceAfter = editor.getAttributes(block)['spaceAfter'];
  const styleNow = currentStyle(editor);

  const stepSize = (by: 1 | -1) => {
    const now = Number(size || 11);
    const next = by > 0 ? SIZES.find((one) => one > now) : [...SIZES].reverse().find((one) => one < now);
    if (next) chain().setFontSize(`${next}pt`).run();
  };

  const paste = async (plain: boolean) => {
    const asText = (text: string) =>
      chain()
        .insertContent(text.replace(/\r\n?/g, '\n').split('\n').map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })))
        .run();
    try {
      if (!plain && navigator.clipboard?.read) {
        for (const item of await navigator.clipboard.read()) {
          if (item.types.includes('text/html')) {
            const html = await (await item.getType('text/html')).text();
            // Through the page's own paste handling, so Word's formatting comes in as a paste from Word does.
            editor.view.pasteHTML(html);
            return;
          }
        }
      }
      const text = await navigator.clipboard.readText();
      if (text) asText(text);
    } catch {
      onSay('The clipboard could not be read here. Press Ctrl+V to paste.');
    }
  };

  const clip = (command: 'cut' | 'copy') => {
    editor.commands.focus();
    if (!document.execCommand(command)) onSay(`Press Ctrl+${command === 'cut' ? 'X' : 'C'} to ${command}.`);
  };

  const listKind = (type: 'a' | 'i' | null) =>
    editor.isActive('orderedList')
      ? chain().updateAttributes('orderedList', { type }).run()
      : type
        ? chain().toggleOrderedList().updateAttributes('orderedList', { type }).run()
        : chain().toggleOrderedList().run();

  return (
    <>
      <Group label="Clipboard">
        <div className="wp-stack-row">
          <Drop label="Paste" title="Paste (Ctrl+V)" face={ICONS.paste} caption="Paste" big onPress={() => void paste(false)}>
            {(close) => (
              <>
                <MenuItem label="Keep source formatting" onPick={() => (close(), void paste(false))} />
                <MenuItem label="Keep text only" onPick={() => (close(), void paste(true))} />
              </>
            )}
          </Drop>
          <div className="wp-stack">
            <Tool label="Cut" title="Cut (Ctrl+X)" onPress={() => clip('cut')}>
              {ICONS.cut}
            </Tool>
            <Tool label="Copy" title="Copy (Ctrl+C)" onPress={() => clip('copy')}>
              {ICONS.copy}
            </Tool>
            <Tool label="Format painter" title="Format Painter: copy the formatting here, then select text to paint it on" active={painting} onPress={onPaint}>
              {ICONS.painter}
            </Tool>
          </div>
        </div>
      </Group>

      <Group label="Font">
        <div className="wp-rows">
          <div className="wp-row">
            <select
              className="wp-select font"
              aria-label="Font"
              value={family}
              onChange={(event) => {
                const chosen = event.target.value;
                if (chosen === MORE_FONTS) {
                  void fonts.askLocal().then((why) => why && onSay(why));
                  return;
                }
                if (chosen) chain().setFontFamily(chosen).run();
                else chain().unsetFontFamily().run();
              }}
            >
              <option value="">Calibri (Body)</option>
              {family && !fonts.groups.some((group) => group.fonts.includes(family)) && !fonts.local?.includes(family) ? (
                <option value={family}>{family}</option>
              ) : null}
              {fonts.groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.fonts
                    .filter((font) => font !== 'Calibri')
                    .map((font) => (
                      <option key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </option>
                    ))}
                </optgroup>
              ))}
              {fonts.local ? (
                <optgroup label="On this computer">
                  {fonts.local.map((font) => (
                    <option key={`local-${font}`} value={font} style={{ fontFamily: font }}>
                      {font}
                    </option>
                  ))}
                </optgroup>
              ) : fonts.canAskLocal ? (
                <option value={MORE_FONTS}>All fonts on this computer…</option>
              ) : null}
            </select>
            <select
              className="wp-select size"
              aria-label="Font size"
              value={size}
              onChange={(event) => (event.target.value ? chain().setFontSize(`${event.target.value}pt`).run() : chain().unsetFontSize().run())}
            >
              <option value="">11</option>
              {SIZES.filter((one) => one !== 11).map((one) => (
                <option key={one} value={String(one)}>
                  {one}
                </option>
              ))}
            </select>
            <Tool label="Increase font size" title="Grow font (Ctrl+])" onPress={() => stepSize(1)}>
              {ICONS.grow}
            </Tool>
            <Tool label="Decrease font size" title="Shrink font (Ctrl+[)" onPress={() => stepSize(-1)}>
              {ICONS.shrink}
            </Tool>
            <Drop label="Change case" face={<span className="wp-face-text">Aa</span>}>
              {(close) =>
                CASES.map((one) => (
                  <MenuItem
                    key={one.id}
                    label={one.label}
                    onPick={() => {
                      close();
                      changeCase(editor, one.id);
                    }}
                  />
                ))
              }
            </Drop>
            <Tool label="Clear formatting" title="Clear all formatting from the selection" onPress={() => chain().unsetAllMarks().run()}>
              {ICONS.clear}
            </Tool>
          </div>
          <div className="wp-row">
            <Tool label="Bold" title="Bold (Ctrl+B)" active={editor.isActive('bold')} onPress={() => chain().toggleBold().run()}>
              <b className="wp-face-text">B</b>
            </Tool>
            <Tool label="Italic" title="Italic (Ctrl+I)" active={editor.isActive('italic')} onPress={() => chain().toggleItalic().run()}>
              <i className="wp-face-text serif">I</i>
            </Tool>
            <Tool label="Underline" title="Underline (Ctrl+U)" active={editor.isActive('underline')} onPress={() => chain().toggleUnderline().run()}>
              <u className="wp-face-text">U</u>
            </Tool>
            <Tool label="Strikethrough" active={editor.isActive('strike')} onPress={() => chain().toggleStrike().run()}>
              <s className="wp-face-text small">ab</s>
            </Tool>
            <Tool label="Subscript" title="Subscript (Ctrl+=)" active={editor.isActive('subscript')} onPress={() => chain().unsetSuperscript().toggleSubscript().run()}>
              <span className="wp-face-text small">
                x<sub>2</sub>
              </span>
            </Tool>
            <Tool label="Superscript" title="Superscript (Ctrl+Shift+=)" active={editor.isActive('superscript')} onPress={() => chain().unsetSubscript().toggleSuperscript().run()}>
              <span className="wp-face-text small">
                x<sup>2</sup>
              </span>
            </Tool>
            <span className="wp-divider" />
            <Drop label="Text highlight colour" face={<HighlightIcon colour={marker} />} onPress={() => chain().setHighlight({ color: marker }).run()}>
              {(close) => (
                <Palette
                  colours={HIGHLIGHTS}
                  onPick={(colour) => {
                    setMarker(colour);
                    chain().setHighlight({ color: colour }).run();
                  }}
                  none="No colour"
                  onNone={() => chain().unsetHighlight().run()}
                  close={close}
                />
              )}
            </Drop>
            <Drop label="Font colour" face={<InkIcon colour={ink} />} onPress={() => chain().setColor(ink).run()}>
              {(close) => (
                <Palette
                  colours={INKS}
                  onPick={(colour) => {
                    setInk(colour);
                    chain().setColor(colour).run();
                  }}
                  none="Automatic"
                  onNone={() => chain().unsetColor().run()}
                  close={close}
                />
              )}
            </Drop>
          </div>
        </div>
      </Group>

      <Group label="Paragraph">
        <div className="wp-rows">
          <div className="wp-row">
            <Tool label="Bullets" active={editor.isActive('bulletList')} onPress={() => chain().toggleBulletList().run()}>
              {ICONS.bullets}
            </Tool>
            <Drop label="Numbering" face={ICONS.numbering} active={editor.isActive('orderedList')} onPress={() => (editor.isActive('orderedList') && !listType ? chain().toggleOrderedList().run() : listKind(null))}>
              {(close) => (
                <>
                  <MenuItem label="1. 2. 3." active={editor.isActive('orderedList') && !listType} onPick={() => (close(), listKind(null))} />
                  <MenuItem label="a. b. c." active={editor.isActive('orderedList') && listType === 'a'} onPick={() => (close(), listKind('a'))} />
                  <MenuItem label="i. ii. iii." active={editor.isActive('orderedList') && listType === 'i'} onPick={() => (close(), listKind('i'))} />
                </>
              )}
            </Drop>
            <Tool label="Decrease indent" onPress={() => (editor.isActive('listItem') ? chain().liftListItem('listItem').run() : chain().indentBlocks(-1).run())}>
              {ICONS.outdent}
            </Tool>
            <Tool label="Increase indent" onPress={() => (editor.isActive('listItem') ? chain().sinkListItem('listItem').run() : chain().indentBlocks(1).run())}>
              {ICONS.indent}
            </Tool>
            <span className="wp-divider" />
            <Tool label="Sort" title="Sort the selected paragraphs A to Z" onPress={() => sortParagraphs(editor) || onSay('Select two or more paragraphs to sort.')}>
              {ICONS.sort}
            </Tool>
            <Tool label="Show formatting marks" title="Show ¶ and other formatting marks (Ctrl+*)" active={view.marks} onPress={() => onView({ marks: !view.marks })}>
              {ICONS.pilcrow}
            </Tool>
          </div>
          <div className="wp-row">
            {(['left', 'center', 'right', 'justify'] as const).map((align) => (
              <Tool
                key={align}
                label={align === 'justify' ? 'Justify' : `Align ${align === 'center' ? 'centre' : align}`}
                title={`${align === 'justify' ? 'Justify' : `Align ${align === 'center' ? 'centre' : align}`} (Ctrl+${{ left: 'L', center: 'E', right: 'R', justify: 'J' }[align]})`}
                active={editor.isActive({ textAlign: align })}
                onPress={() => chain().setTextAlign(align).run()}
              >
                {ICONS[align === 'left' ? 'alignLeft' : align === 'center' ? 'alignCenter' : align === 'right' ? 'alignRight' : 'justify']}
              </Tool>
            ))}
            <span className="wp-divider" />
            <Drop label="Line and paragraph spacing" face={ICONS.spacing}>
              {(close) => (
                <>
                  <div className="wp-menu-head">Line spacing</div>
                  {[1, 1.15, 1.5, 2, 2.5, 3].map((one) => (
                    <MenuItem
                      key={one}
                      label={one.toFixed(one === 1.15 ? 2 : 1)}
                      active={Number(lineHeight) === one}
                      onPick={() => {
                        close();
                        chain().setBlockAttribute('lineHeight', one).run();
                      }}
                    />
                  ))}
                  <div className="wp-menu-head">Space after paragraph</div>
                  {[0, 6, 12, 18, 24].map((one) => (
                    <MenuItem
                      key={one}
                      label={`${one} pt`}
                      active={spaceAfter !== null && spaceAfter !== undefined && Number(spaceAfter) === one}
                      onPick={() => {
                        close();
                        chain().setBlockAttribute('spaceAfter', one).run();
                      }}
                    />
                  ))}
                  <MenuItem
                    label="Back to the style's spacing"
                    onPick={() => {
                      close();
                      chain().setBlockAttribute('lineHeight', null).setBlockAttribute('spaceAfter', null).run();
                    }}
                  />
                </>
              )}
            </Drop>
          </div>
        </div>
      </Group>

      <Group label="Styles">
        <div className="wp-gallery" role="listbox" aria-label="Styles">
          {STYLE_TILES.map((id) => {
            const one = STYLES.find((each) => each.id === id)!;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={styleNow === id}
                className={`wp-style-tile${styleNow === id ? ' active' : ''}`}
                title={one.label}
                tabIndex={-1}
                onMouseDown={(event) => {
                  event.preventDefault();
                  applyStyle(editor, id);
                }}
              >
                <span className={`wp-style-sample ${id}`}>AaBbCc</span>
                <span className="wp-style-name">{one.label}</span>
              </button>
            );
          })}
          <Drop label="All styles" face={null}>
            {(close) =>
              STYLES.map((one) => (
                <MenuItem
                  key={one.id}
                  label={one.label}
                  active={styleNow === one.id}
                  onPick={() => {
                    close();
                    applyStyle(editor, one.id);
                  }}
                />
              ))
            }
          </Drop>
        </div>
      </Group>

      <Group label="Editing">
        <div className="wp-stack">
          <Tool label="Find" title="Find (Ctrl+F)" onPress={() => onFind('find')} wide>
            {ICONS.find}
            <span>Find</span>
          </Tool>
          <Tool label="Replace" title="Find and replace (Ctrl+H)" onPress={() => onFind('replace')} wide>
            {ICONS.replace}
            <span>Replace</span>
          </Tool>
        </div>
      </Group>

      <Group label="Voice">
        <Tool label={speech.dictating ? 'Stop dictating' : 'Dictate'} title="Speak, and the words are typed at the cursor" active={speech.dictating} onPress={speech.dictate} big>
          {ICONS.dictate}
          <span className="wp-caption">{speech.dictating ? 'Stop' : 'Dictate'}</span>
        </Tool>
      </Group>
    </>
  );
}

function InsertTab({ editor, headerFooter }: TabProps) {
  const picture = useRef<HTMLInputElement>(null);
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState('');
  const [symbols, setSymbols] = useState(false);
  const [shapes, setShapes] = useState(false);
  const [fill, setFill] = useState(SHAPE_FILLS[0]!);
  const chain = () => editor.chain().focus();
  const inTable = editor.isActive('table');
  return (
    <>
      <Group label="Pages">
        <Tool label="Page break" title="Page break (Ctrl+Enter)" onPress={() => chain().setPageBreak().run()} wide />
      </Group>
      <Group label="Tables">
        <Tool label="Table" title="Insert a 3 × 3 table with a header row" onPress={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} wide />
        {inTable ? (
          <>
            <Tool label="Row above" onPress={() => chain().addRowBefore().run()} wide />
            <Tool label="Row below" onPress={() => chain().addRowAfter().run()} wide />
            <Tool label="Column left" onPress={() => chain().addColumnBefore().run()} wide />
            <Tool label="Column right" onPress={() => chain().addColumnAfter().run()} wide />
            <Tool label="Merge cells" onPress={() => chain().mergeCells().run()} disabled={!editor.can().mergeCells()} wide />
            <Tool label="Split cell" onPress={() => chain().splitCell().run()} disabled={!editor.can().splitCell()} wide />
            <Tool label="Header row" onPress={() => chain().toggleHeaderRow().run()} wide />
            <Tool label="Delete row" onPress={() => chain().deleteRow().run()} wide />
            <Tool label="Delete column" onPress={() => chain().deleteColumn().run()} wide />
            <Tool label="Delete table" onPress={() => chain().deleteTable().run()} wide />
          </>
        ) : null}
      </Group>
      <Group label="Illustrations">
        <Tool label="Picture…" title="Insert a picture from this computer" onPress={() => picture.current?.click()} wide />
        <Tool label="Shapes" title="Rectangles, ovals, arrows, stars and more" active={shapes} onPress={() => setShapes(!shapes)} wide />
        {shapes ? (
          <div className="wp-shapes" role="group" aria-label="Shapes">
            {SHAPES.map((shape) => (
              <Tool
                key={shape.id}
                label={`Insert ${shape.name.toLowerCase()}`}
                title={shape.name}
                onPress={() => {
                  void insertShape(editor, shape.id as ShapeId, fill);
                  setShapes(false);
                }}
              >
                <span className="wp-shape-icon" aria-hidden dangerouslySetInnerHTML={{ __html: shapeSvg(shape.id, fill) }} />
              </Tool>
            ))}
            <div className="wp-shape-fills" role="group" aria-label="Shape fill">
              {[...SHAPE_FILLS, NO_FILL].map((one) => (
                <button
                  key={one}
                  type="button"
                  className={`wp-swatch${one === NO_FILL ? ' none' : ''}${one === fill ? ' chosen' : ''}`}
                  style={one === NO_FILL ? undefined : { background: one }}
                  aria-label={one === NO_FILL ? 'No fill' : `Fill ${one}`}
                  aria-pressed={one === fill}
                  title={one === NO_FILL ? 'Outline only' : one}
                  tabIndex={-1}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setFill(one);
                  }}
                >
                  {one === NO_FILL ? '∅' : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <input
          ref={picture}
          type="file"
          accept="image/png,image/jpeg,image/gif"
          hidden
          aria-label="Choose a picture"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            event.target.value = '';
            if (!chosen) return;
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') editor.chain().focus().setImage({ src: reader.result, alt: chosen.name }).run();
            };
            reader.readAsDataURL(chosen);
          }}
        />
      </Group>
      <Group label="Header & footer">
        <Tool
          label="Header & footer"
          title="Text at the top and foot of every page, with page numbers, the title or the date"
          active={headerFooter.open}
          onPress={headerFooter.onToggle}
          wide
        />
        <select
          className="wp-select"
          aria-label="Page numbers"
          title="Where the page numbers go"
          value={headerFooter.pageNumbers === 'custom' ? 'custom' : headerFooter.pageNumbers}
          onChange={(event) => {
            if (event.target.value !== 'custom') headerFooter.onPageNumbers(event.target.value as PageNumberPreset | 'none');
          }}
        >
          <option value="none">Page numbers: none</option>
          {PAGE_NUMBER_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
          {headerFooter.pageNumbers === 'custom' ? <option value="custom">Your own (in Header &amp; footer)</option> : null}
        </select>
      </Group>
      <Group label="Links">
        {linking ? (
          <form
            className="wp-inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              const target = href.trim();
              if (target) chain().extendMarkRange('link').setLink({ href: /^[a-z]+:/i.test(target) ? target : `https://${target}` }).run();
              setLinking(false);
              setHref('');
            }}
          >
            <input autoFocus aria-label="Link address" placeholder="https://" value={href} onChange={(event) => setHref(event.target.value)} />
            <button type="submit">Link</button>
            <button type="button" className="ghost" onClick={() => setLinking(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <Tool
              label="Link…"
              title="Make the selection a link"
              onPress={() => {
                setHref(String(editor.getAttributes('link')['href'] ?? ''));
                setLinking(true);
              }}
              wide
            />
            {editor.isActive('link') ? <Tool label="Remove link" onPress={() => chain().extendMarkRange('link').unsetLink().run()} wide /> : null}
          </>
        )}
      </Group>
      <Group label="Text">
        <Tool label="Horizontal line" onPress={() => chain().setHorizontalRule().run()} wide />
        <Tool
          label="Date"
          title="Insert today's date"
          onPress={() => chain().insertContent(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })).run()}
          wide
        />
        <Tool label="Symbol" active={symbols} onPress={() => setSymbols(!symbols)} wide />
        {symbols ? (
          <div className="wp-symbols" role="group" aria-label="Symbols">
            {SYMBOLS.map((symbol) => (
              <Tool key={symbol} label={`Insert ${symbol}`} title={symbol} onPress={() => chain().insertContent(symbol).run()}>
                {symbol}
              </Tool>
            ))}
          </div>
        ) : null}
      </Group>
    </>
  );
}

function LayoutTab({ pageSetup, onPageSetup, editor }: TabProps) {
  const preset = MARGIN_PRESETS.findIndex(
    (one) =>
      one.margins.top === pageSetup.margins.top &&
      one.margins.right === pageSetup.margins.right &&
      one.margins.bottom === pageSetup.margins.bottom &&
      one.margins.left === pageSetup.margins.left,
  );
  return (
    <>
      <Group label="Page setup">
        <label className="wp-field">
          <span>Size</span>
          <select className="wp-select" value={pageSetup.paper} onChange={(event) => onPageSetup({ paper: event.target.value as PaperSize })}>
            {(Object.keys(PAPER_SIZES) as PaperSize[]).map((paper) => (
              <option key={paper} value={paper}>
                {PAPER_SIZES[paper].name}
              </option>
            ))}
          </select>
        </label>
        <label className="wp-field">
          <span>Orientation</span>
          <select
            className="wp-select"
            value={pageSetup.orientation}
            onChange={(event) => onPageSetup({ orientation: event.target.value as 'portrait' | 'landscape' })}
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
        <label className="wp-field">
          <span>Margins</span>
          <select
            className="wp-select"
            value={preset >= 0 ? String(preset) : 'custom'}
            onChange={(event) => {
              const chosen = MARGIN_PRESETS[Number(event.target.value)];
              if (chosen) onPageSetup({ margins: chosen.margins });
            }}
          >
            {MARGIN_PRESETS.map((one, index) => (
              <option key={one.label} value={String(index)}>
                {one.label}
              </option>
            ))}
            {preset < 0 ? <option value="custom">Custom</option> : null}
          </select>
        </label>
        {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
          <label key={side} className="wp-field narrow">
            <span>{side[0]!.toUpperCase() + side.slice(1)}</span>
            <input
              type="number"
              min={0}
              max={4}
              step={0.05}
              value={pageSetup.margins[side]}
              aria-label={`${side} margin, inches`}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) onPageSetup({ margins: { [side]: Math.min(4, Math.max(0, value)) } });
              }}
            />
          </label>
        ))}
      </Group>
      <Group label="Breaks">
        <Tool label="Page break" onPress={() => editor.chain().focus().setPageBreak().run()} wide />
      </Group>
    </>
  );
}

/**
 * **References** (addendum 43 §11): Word's tab of the same name, on the
 * project's own Reference Library — insert a citation, put a bibliography
 * where the cursor is, open the library and the style, or bring in another
 * project's sources.
 */
function ReferencesTab({ references }: TabProps) {
  return (
    <>
      {/* Word's References tab begins with its table of contents (addendum 42 §19). */}
      <Group label="Table of contents">
        <Tool label="Table of contents" title="A table of contents here, from the document's headings, with the page each is on; it keeps itself current" onPress={references.onContents} wide>
          Table of contents
        </Tool>
      </Group>
      {/* Word keeps its notes first on this tab (addendum 42 §18). */}
      <Group label="Footnotes">
        <Tool label="Insert footnote" title="A footnote at the cursor, set at the foot of its page (Ctrl+Alt+F)" onPress={references.onFootnote} wide>
          Insert footnote
        </Tool>
        <Tool label="Insert endnote" title="An endnote at the cursor, set at the end of the document (Ctrl+Alt+D)" onPress={references.onEndnote} wide>
          Insert endnote
        </Tool>
      </Group>
      <Group label="Citations">
        <Tool label="Insert citation" title="Cite a source from the library at the cursor (Ctrl+Shift+C)" onPress={references.onCite} wide>
          Insert citation
        </Tool>
        <Tool label="Bibliography" title="A bibliography here, listing the sources this document cites; it keeps itself current" onPress={references.onBibliography} wide>
          Bibliography
        </Tool>
      </Group>
      <Group label="Library">
        <Tool label="Sources & style" title="The Reference Library, and how this project cites" onPress={references.onLibrary} wide>
          Sources &amp; style
        </Tool>
        <Tool label="Bring in sources" title="Copy sources from another project's library into this one" onPress={references.onBringIn} wide>
          Bring in sources…
        </Tool>
      </Group>
      <Group label="This document">
        <span className="wp-ribbon-note">
          {references.style} · {references.cited === 1 ? '1 citation' : `${references.cited} citations`} · {references.library === 1 ? '1 source' : `${references.library} sources`} in the library
        </span>
      </Group>
    </>
  );
}

function ReviewTab({ view, onView, words, characters, speech, comments, changes }: TabProps) {
  return (
    <>
      {/* Word's Review tab: comments first (addendum 42 §20). */}
      <Group label="Comments">
        <Tool label="New comment" title="A comment on the selected words (Ctrl+Alt+M)" onPress={comments.onNew} wide>
          New comment
        </Tool>
        <Tool label="Previous comment" title="The comment before this one" onPress={comments.onPrevious} disabled={comments.count === 0} wide>
          Previous
        </Tool>
        <Tool label="Next comment" title="The comment after this one" onPress={comments.onNext} disabled={comments.count === 0} wide>
          Next
        </Tool>
        <Tool label="Show comments" title="Show or hide the comments beside the page" active={comments.shown} onPress={comments.onShow} wide>
          Show comments
        </Tool>
      </Group>
      <Group label="Tracking">
        <Tool
          label="Track changes"
          title="While on, what is typed is underlined and what is deleted is struck through, until accepted or rejected (Ctrl+Shift+E)"
          active={changes.tracking}
          onPress={changes.onTrack}
          wide
        >
          Track changes
        </Tool>
      </Group>
      <Group label={changes.count === 1 ? '1 change' : `${changes.count} changes`}>
        <Tool label="Accept" title="Keep this change and go to the next" onPress={changes.onAccept} disabled={changes.count === 0} wide>
          Accept
        </Tool>
        <Tool label="Reject" title="Undo this change and go to the next" onPress={changes.onReject} disabled={changes.count === 0} wide>
          Reject
        </Tool>
        <Tool label="Accept all" title="Keep every change in the document" onPress={changes.onAcceptAll} disabled={changes.count === 0} wide>
          Accept all
        </Tool>
        <Tool label="Reject all" title="Undo every change in the document" onPress={changes.onRejectAll} disabled={changes.count === 0} wide>
          Reject all
        </Tool>
        <Tool label="Previous change" title="The change before the cursor" onPress={changes.onPrevious} disabled={changes.count === 0} wide>
          Previous
        </Tool>
        <Tool label="Next change" title="The change after the cursor" onPress={changes.onNext} disabled={changes.count === 0} wide>
          Next
        </Tool>
      </Group>
      <Group label="Speech">
        <Tool
          label={speech.dictating ? 'Stop dictating' : 'Dictate'}
          title="Speak, and the words are typed at the cursor"
          active={speech.dictating}
          onPress={speech.dictate}
          wide
        />
        {speech.canRead && !speech.voicesInstalled ? (
          <Tool
            label={speech.voicesProgress !== null ? `Downloading ${Math.round(speech.voicesProgress * 100)}%` : 'Get voices'}
            title="Read aloud uses VC Writer's natural voices: download them once (about 100 MB, free, works offline)"
            disabled={speech.voicesProgress !== null}
            onPress={() => void speech.getVoices()}
            wide
          />
        ) : (
          <Tool
            label={speech.reading ? 'Stop reading' : 'Read aloud'}
            title={speech.canRead ? 'Hear the selection, or from the cursor to the end' : 'Reading aloud runs in the desktop app'}
            active={speech.reading}
            disabled={!speech.canRead}
            onPress={() => void speech.read()}
            wide
          />
        )}
        <select className="wp-select" aria-label="Reading speed" value={String(speech.rate)} onChange={(event) => speech.setRate(Number(event.target.value))}>
          {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
            <option key={rate} value={String(rate)}>
              {rate === 1 ? 'Normal speed' : `${rate}×`}
            </option>
          ))}
        </select>
        {speech.voices.length > 0 ? (
          <select className="wp-select voice" aria-label="Reading voice" value={speech.voiceId} onChange={(event) => speech.setVoiceId(event.target.value)}>
            {speech.voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
              </option>
            ))}
          </select>
        ) : null}
      </Group>
      <Group label="Proofing">
        <Tool
          label="Spelling"
          title="Underline misspelled words as you type"
          active={view.spelling}
          onPress={() => onView({ spelling: !view.spelling })}
          wide
        />
      </Group>
      <Group label="Word count">
        <span className="wp-count">
          {words.toLocaleString()} words · {characters.toLocaleString()} characters
        </span>
      </Group>
    </>
  );
}

function ViewTab({ view, onView }: TabProps) {
  return (
    <>
      <Group label="Views">
        <Tool label="Print layout" active={view.layout === 'print'} onPress={() => onView({ layout: 'print' })} wide />
        <Tool label="Web layout" title="One continuous column, no pages" active={view.layout === 'web'} onPress={() => onView({ layout: 'web' })} wide />
      </Group>
      <Group label="Show">
        <Tool label="Navigation pane" active={view.navigation} onPress={() => onView({ navigation: !view.navigation })} wide />
        <Tool label="Formatting marks" title="Show ¶ at each paragraph's end" active={view.marks} onPress={() => onView({ marks: !view.marks })} wide />
      </Group>
      <Group label="Zoom">
        <Tool label="One page" title="The whole page in the window" active={view.fit === 'page'} onPress={() => onView({ fit: 'page', layout: 'print' })} wide />
        <Tool label="Page width" title="The page as wide as the window" active={view.fit === 'width'} onPress={() => onView({ fit: 'width', layout: 'print' })} wide />
        {[0.75, 1, 1.25, 1.5].map((zoom) => (
          <Tool key={zoom} label={`${Math.round(zoom * 100)}%`} active={view.fit === 'none' && view.zoom === zoom} onPress={() => onView({ zoom, fit: 'none' })} />
        ))}
      </Group>
    </>
  );
}
