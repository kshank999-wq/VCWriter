import { useRef, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { PAPER_SIZES, type DocumentPageSetup, type PaperSize } from '@vcwriter/domain';

/**
 * **The ribbon** (addendum 42 §3): Word's tabs of grouped controls, over the
 * page.
 *
 * Every control does something. The spec's rule (§14) is that a feature the
 * editor cannot do is left off rather than shown greyed, so headers and
 * footers, footnotes, comments and tracked changes have no buttons here yet.
 * The addendum lists them as follow-on work.
 *
 * Buttons take the press on mouse-down and refuse focus, which keeps the
 * selection in the page. That is how Word behaves, and it is what lets a
 * writer select a word and press Bold without the word being deselected.
 */

export type RibbonTab = 'file' | 'home' | 'insert' | 'layout' | 'review' | 'view';

const TABS: { id: RibbonTab; label: string }[] = [
  { id: 'file', label: 'File' },
  { id: 'home', label: 'Home' },
  { id: 'insert', label: 'Insert' },
  { id: 'layout', label: 'Layout' },
  { id: 'review', label: 'Review' },
  { id: 'view', label: 'View' },
];

export const FONTS = [
  'Calibri',
  'Arial',
  'Cambria',
  'Courier New',
  'Garamond',
  'Georgia',
  'Helvetica',
  'Palatino',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
];

export const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

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
}

/** A ribbon button: pressed on mouse-down so the page keeps its selection. */
function Tool({
  label,
  title,
  active,
  disabled,
  onPress,
  children,
  wide,
}: {
  label: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  onPress(): void;
  children?: ReactNode;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      className={`wp-tool${active ? ' active' : ''}${wide ? ' wide' : ''}`}
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

function Swatches({
  label,
  colours,
  onPick,
  onClear,
  clearLabel,
}: {
  label: string;
  colours: string[];
  onPick(colour: string): void;
  onClear(): void;
  clearLabel: string;
}) {
  return (
    <div className="wp-swatches" role="group" aria-label={label}>
      {colours.map((colour) => (
        <button
          key={colour}
          type="button"
          className="wp-swatch"
          style={{ background: colour }}
          aria-label={`${label} ${colour}`}
          title={colour}
          tabIndex={-1}
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(colour);
          }}
        />
      ))}
      <button
        type="button"
        className="wp-swatch none"
        aria-label={clearLabel}
        title={clearLabel}
        tabIndex={-1}
        onMouseDown={(event) => {
          event.preventDefault();
          onClear();
        }}
      >
        ∅
      </button>
    </div>
  );
}

export function Ribbon(props: RibbonProps) {
  const { editor, tab, onTab } = props;
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
        {tab === 'review' ? <ReviewTab {...props} /> : null}
        {tab === 'view' ? <ViewTab {...props} /> : null}
      </div>
    </div>
  );
}

function FileTab({ file }: RibbonProps) {
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

function HomeTab({ editor, onFind, painting, onPaint }: RibbonProps) {
  const style = editor.getAttributes('textStyle');
  const family = typeof style['fontFamily'] === 'string' ? String(style['fontFamily']).split(',')[0]?.replace(/["']/g, '').trim() : '';
  const size = typeof style['fontSize'] === 'string' ? String(style['fontSize']).replace(/pt$/, '') : '';
  const chain = () => editor.chain().focus();
  const listType = editor.getAttributes('orderedList')['type'];
  return (
    <>
      <Group label="Clipboard">
        <Tool label="Format painter" title="Copy the formatting here, then select text to paint it on" active={painting} onPress={onPaint} wide />
        <Tool
          label="Paste as text"
          title="Paste the clipboard's words without their formatting"
          onPress={() => {
            void navigator.clipboard?.readText?.().then((text) => {
              if (text) editor.chain().focus().insertContent(text.replace(/\r\n?/g, '\n').split('\n').map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] }))).run();
            });
          }}
          wide
        />
      </Group>
      <Group label="Font">
        <select
          className="wp-select font"
          aria-label="Font"
          value={family}
          onChange={(event) => (event.target.value ? chain().setFontFamily(event.target.value).run() : chain().unsetFontFamily().run())}
        >
          <option value="">Calibri (Body)</option>
          {FONTS.filter((font) => font !== 'Calibri').map((font) => (
            <option key={font} value={font} style={{ fontFamily: font }}>
              {font}
            </option>
          ))}
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
        <Tool label="Bold" title="Bold (Ctrl+B)" active={editor.isActive('bold')} onPress={() => chain().toggleBold().run()}>
          <b>B</b>
        </Tool>
        <Tool label="Italic" title="Italic (Ctrl+I)" active={editor.isActive('italic')} onPress={() => chain().toggleItalic().run()}>
          <i>I</i>
        </Tool>
        <Tool label="Underline" title="Underline (Ctrl+U)" active={editor.isActive('underline')} onPress={() => chain().toggleUnderline().run()}>
          <u>U</u>
        </Tool>
        <Tool label="Strikethrough" active={editor.isActive('strike')} onPress={() => chain().toggleStrike().run()}>
          <s>ab</s>
        </Tool>
        <Tool label="Subscript" active={editor.isActive('subscript')} onPress={() => chain().unsetSuperscript().toggleSubscript().run()}>
          x<sub>2</sub>
        </Tool>
        <Tool label="Superscript" active={editor.isActive('superscript')} onPress={() => chain().unsetSubscript().toggleSuperscript().run()}>
          x<sup>2</sup>
        </Tool>
        <Tool label="Clear formatting" title="Clear all formatting from the selection" onPress={() => chain().unsetAllMarks().run()}>
          A⌫
        </Tool>
        <Swatches
          label="Font colour"
          colours={INKS}
          onPick={(colour) => chain().setColor(colour).run()}
          onClear={() => chain().unsetColor().run()}
          clearLabel="Automatic colour"
        />
        <Swatches
          label="Highlight"
          colours={HIGHLIGHTS}
          onPick={(colour) => chain().setHighlight({ color: colour }).run()}
          onClear={() => chain().unsetHighlight().run()}
          clearLabel="No highlight"
        />
      </Group>
      <Group label="Paragraph">
        <Tool label="Bullets" active={editor.isActive('bulletList')} onPress={() => chain().toggleBulletList().run()}>
          •≡
        </Tool>
        <Tool
          label="Numbering"
          active={editor.isActive('orderedList') && !listType}
          onPress={() =>
            editor.isActive('orderedList') && listType
              ? chain().updateAttributes('orderedList', { type: null }).run()
              : chain().toggleOrderedList().run()
          }
        >
          1.≡
        </Tool>
        <Tool
          label="Lettered list"
          active={editor.isActive('orderedList') && listType === 'a'}
          onPress={() =>
            editor.isActive('orderedList')
              ? chain().updateAttributes('orderedList', { type: listType === 'a' ? null : 'a' }).run()
              : chain().toggleOrderedList().updateAttributes('orderedList', { type: 'a' }).run()
          }
        >
          a.≡
        </Tool>
        <Tool
          label="Roman numbered list"
          active={editor.isActive('orderedList') && listType === 'i'}
          onPress={() =>
            editor.isActive('orderedList')
              ? chain().updateAttributes('orderedList', { type: listType === 'i' ? null : 'i' }).run()
              : chain().toggleOrderedList().updateAttributes('orderedList', { type: 'i' }).run()
          }
        >
          i.≡
        </Tool>
        <Tool
          label="Decrease indent"
          onPress={() => (editor.isActive('listItem') ? chain().liftListItem('listItem').run() : chain().indentBlocks(-1).run())}
        >
          ⇤
        </Tool>
        <Tool
          label="Increase indent"
          onPress={() => (editor.isActive('listItem') ? chain().sinkListItem('listItem').run() : chain().indentBlocks(1).run())}
        >
          ⇥
        </Tool>
        {(['left', 'center', 'right', 'justify'] as const).map((align) => (
          <Tool
            key={align}
            label={`Align ${align === 'center' ? 'centre' : align}`}
            active={editor.isActive({ textAlign: align })}
            onPress={() => chain().setTextAlign(align).run()}
          >
            {align === 'left' ? '⫷' : align === 'center' ? '≡' : align === 'right' ? '⫸' : '☰'}
          </Tool>
        ))}
        <select
          className="wp-select spacing"
          aria-label="Line spacing"
          value={String(editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph')['lineHeight'] ?? '')}
          onChange={(event) => chain().setBlockAttribute('lineHeight', event.target.value ? Number(event.target.value) : null).run()}
        >
          <option value="">Line spacing</option>
          <option value="1">1.0</option>
          <option value="1.15">1.15</option>
          <option value="1.5">1.5</option>
          <option value="2">2.0</option>
          <option value="2.5">2.5</option>
          <option value="3">3.0</option>
        </select>
        <select
          className="wp-select spacing"
          aria-label="Space after paragraph"
          value={String(editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph')['spaceAfter'] ?? '')}
          onChange={(event) => chain().setBlockAttribute('spaceAfter', event.target.value ? Number(event.target.value) : null).run()}
        >
          <option value="">Space after</option>
          <option value="0">0 pt</option>
          <option value="6">6 pt</option>
          <option value="12">12 pt</option>
          <option value="18">18 pt</option>
          <option value="24">24 pt</option>
        </select>
      </Group>
      <Group label="Styles">
        <select className="wp-select style" aria-label="Style" value={currentStyle(editor)} onChange={(event) => applyStyle(editor, event.target.value)}>
          {STYLES.map((one) => (
            <option key={one.id} value={one.id}>
              {one.label}
            </option>
          ))}
        </select>
      </Group>
      <Group label="Editing">
        <Tool label="Find" title="Find (Ctrl+F)" onPress={() => onFind('find')} wide />
        <Tool label="Replace" title="Find and replace (Ctrl+H)" onPress={() => onFind('replace')} wide />
      </Group>
    </>
  );
}

function InsertTab({ editor }: RibbonProps) {
  const picture = useRef<HTMLInputElement>(null);
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState('');
  const [symbols, setSymbols] = useState(false);
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

function LayoutTab({ pageSetup, onPageSetup, editor }: RibbonProps) {
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

function ReviewTab({ view, onView, words, characters }: RibbonProps) {
  return (
    <>
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

function ViewTab({ view, onView }: RibbonProps) {
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
        {[0.75, 1, 1.25, 1.5].map((zoom) => (
          <Tool key={zoom} label={`${Math.round(zoom * 100)}%`} active={view.zoom === zoom} onPress={() => onView({ zoom })} />
        ))}
      </Group>
    </>
  );
}
