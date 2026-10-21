import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import type { Mark } from '@tiptap/pm/model';
import {
  DOCUMENT_CONTENT_CSS,
  countTextWords,
  docHeadings,
  docPlainText,
  docWordCount,
  docxToDocContent,
  documentPrintHtml,
  buildDocumentDocx,
  DOCX_MEDIA_TYPE,
  pageSize,
  readDocx,
  setDocumentContent,
  setDocumentPageSetup,
  textToDocContent,
  type DocNode,
  type ProjectFile,
  type WpDocument,
} from '@vcwriter/domain';
import { readDocxParts } from '../read-docx';
import { documentExtensions, findMatches, searchKey, type SearchState } from './extensions';
import { Ribbon, type RibbonTab, type ViewState } from './Ribbon';
import { documentCommands } from './document-commands';
import './document.css';

/**
 * **The word processor** (addendum 42): what a Document project shows instead
 * of the story workspace.
 *
 * The editor keeps its own document and its own undo, as Word does. What it
 * hands the project is the finished tree, a beat after each burst of typing,
 * through the same `onUpdate` every other edit uses, so saving, autosave,
 * recovery points and sync see a document exactly as they see a beat.
 */

interface DocumentWorkspaceProps {
  file: ProjectFile;
  document: WpDocument;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  saveState: string;
  onSave(): void;
  onSaveAs(): void;
  readOnly?: boolean;
}

/** How long typing must pause before the tree is handed to the project. */
const SETTLE_MS = 300;

const PX_PER_INCH = 96;

/** The project's save state, in the words Word's status bar would use. */
const SAVE_WORDS: Record<string, string> = {
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  idle: '',
  error: 'Not saved',
};

const download = async (name: string, bytes: Uint8Array, mediaType: string, kind: { name: string; extension: string }) =>
  window.vcwriter.saveFile({ name, bytes, mediaType, kind });

export function DocumentWorkspace({ file, document, onUpdate, saveState, onSave, onSaveAs, readOnly = false }: DocumentWorkspaceProps) {
  const [tab, setTab] = useState<RibbonTab>('home');
  const [view, setView] = useState<ViewState>({ layout: 'print', navigation: false, marks: false, spelling: true, zoom: 1 });
  const [finding, setFinding] = useState<'off' | 'find' | 'replace'>('off');
  const [search, setSearch] = useState<SearchState>({ query: '', caseSensitive: false, wholeWord: false, current: -1 });
  const [replacement, setReplacement] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [painter, setPainter] = useState<readonly Mark[] | null>(null);
  const [pages, setPages] = useState(1);

  const documentId = document.id;
  // What this editor last handed the project, so an echo of it is not taken
  // for a change made somewhere else.
  const pushed = useRef<DocNode | null>(document.content);
  const pushedJson = useRef<string>(JSON.stringify(document.content));
  const timer = useRef<number | null>(null);

  const flush = useCallback(
    (editor: Editor | null) => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      if (!editor) return;
      const content = editor.getJSON() as DocNode;
      const json = JSON.stringify(content);
      if (json === pushedJson.current) return;
      pushed.current = content;
      pushedJson.current = json;
      onUpdate((current) => setDocumentContent(current, documentId, content));
    },
    [documentId, onUpdate],
  );

  const editor = useEditor({
    extensions: documentExtensions(),
    content: document.content,
    editable: !readOnly,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: 'wp-doc', spellcheck: 'true', 'aria-label': 'Document' },
      // A picture pasted or dropped from another program comes in as a picture.
      handlePaste: (_view, event) => insertPictures(event.clipboardData?.files),
      handleDrop: (_view, event) => insertPictures((event as DragEvent).dataTransfer?.files),
    },
    onUpdate: ({ editor: current }) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => flush(current), SETTLE_MS);
    },
  });

  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  function insertPictures(files: FileList | undefined | null): boolean {
    const pictures = Array.from(files ?? []).filter((one) => /^image\/(png|jpeg|gif)$/.test(one.type));
    if (!pictures.length) return false;
    pictures.forEach((picture) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') editorRef.current?.chain().focus().setImage({ src: reader.result, alt: picture.name }).run();
      };
      reader.readAsDataURL(picture);
    });
    return true;
  }

  // A change that did not come from this editor: an undo of the whole
  // project, a sync, a recovery point. The editor takes the project's version.
  useEffect(() => {
    if (!editor || document.content === pushed.current) return;
    const json = JSON.stringify(document.content);
    if (json === pushedJson.current) return;
    pushed.current = document.content;
    pushedJson.current = json;
    editor.commands.setContent(document.content, { emitUpdate: false });
  }, [editor, document.content]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Whatever is still settling is handed over when the workspace closes.
  useEffect(() => () => flush(editorRef.current), [flush]);

  // ------------------------------------------------------------ find

  const matches = useMemo(
    () => (editor && search.query ? findMatches(editor.state.doc, search) : []),
    // The doc is read fresh on each render; this re-runs when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, editor?.state.doc, search.query, search.caseSensitive, search.wholeWord],
  );

  useEffect(() => {
    editor?.commands.setSearch(finding === 'off' ? { ...search, query: '' } : search);
  }, [editor, search, finding]);

  const goTo = (index: number) => {
    if (!editor || !matches.length) return;
    const next = ((index % matches.length) + matches.length) % matches.length;
    const match = matches[next]!;
    setSearch((current) => ({ ...current, current: next }));
    editor.chain().setTextSelection({ from: match.from, to: match.to }).scrollIntoView().run();
  };

  const replaceOne = () => {
    if (!editor || readOnly || !matches.length) return;
    const index = search.current >= 0 && search.current < matches.length ? search.current : 0;
    const match = matches[index]!;
    editor.chain().insertContentAt({ from: match.from, to: match.to }, replacement).run();
    setSearch((current) => ({ ...current, current: index }));
  };

  const replaceAll = () => {
    if (!editor || readOnly || !matches.length) return;
    const { tr } = editor.state;
    // From the end, so earlier positions stay where they were.
    [...matches].reverse().forEach((match) => tr.insertText(replacement, match.from, match.to));
    editor.view.dispatch(tr);
    setMessage(`Replaced ${matches.length} ${matches.length === 1 ? 'match' : 'matches'}.`);
  };

  // ----------------------------------------------------- format painter

  const startPainter = () => {
    if (!editor) return;
    if (painter) {
      setPainter(null);
      return;
    }
    const { $from } = editor.state.selection;
    setPainter(editor.state.storedMarks ?? $from.marks());
  };

  useEffect(() => {
    if (!editor || !painter) return;
    const paint = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty) return;
      const { tr } = editor.state;
      tr.removeMark(from, to);
      painter.forEach((mark) => tr.addMark(from, to, mark));
      editor.view.dispatch(tr);
      setPainter(null);
    };
    // A selection made with the mouse is finished when the button comes up.
    const root = editor.view.dom;
    root.addEventListener('mouseup', paint);
    return () => root.removeEventListener('mouseup', paint);
  }, [editor, painter]);

  // ------------------------------------------------------ file actions

  const docOf = useCallback(() => {
    flush(editorRef.current);
    const content = (editorRef.current?.getJSON() as DocNode | undefined) ?? document.content;
    return { ...document, content };
  }, [document, flush]);

  const printable = useCallback(() => {
    const current = docOf();
    return {
      html: documentPrintHtml(current, editorRef.current?.getHTML() ?? ''),
      paper: pageSize(current.pageSetup),
    };
  }, [docOf]);

  const print = useCallback(async () => {
    const { html, paper } = printable();
    const result = await window.vcwriter.print({ file, kind: 'document', html, paper });
    if (!result.ok) setMessage(result.error ?? 'The document could not be printed');
  }, [file, printable]);

  const exportPdf = useCallback(async () => {
    const { html, paper } = printable();
    const result = await window.vcwriter.exportPdf({ file, kind: 'document', html, paper });
    if (!result.ok) setMessage(result.error ?? 'The PDF could not be created');
    else if (result.data?.path) setMessage(`Saved ${result.data.path}`);
  }, [file, printable]);

  const baseName = (document.title || file.project.title || 'Untitled').replace(/[^\w\-. ]+/g, '').trim() || 'Untitled';

  const exportDocx = useCallback(async () => {
    const bytes = await buildDocumentDocx(docOf(), { author: file.project.author ?? '' });
    const result = await download(`${baseName}.docx`, bytes, DOCX_MEDIA_TYPE, { name: 'Word document', extension: 'docx' });
    if (!result.ok) setMessage(result.error ?? 'The Word file could not be saved');
    else if (result.data?.path) setMessage(`Saved ${result.data.path}`);
  }, [docOf, file.project.author, baseName]);

  const exportText = useCallback(async () => {
    const text = docPlainText(docOf().content);
    const result = await download(`${baseName}.txt`, new TextEncoder().encode(text), 'text/plain', { name: 'Text', extension: 'txt' });
    if (!result.ok) setMessage(result.error ?? 'The text file could not be saved');
    else if (result.data?.path) setMessage(`Saved ${result.data.path}`);
  }, [docOf, baseName]);

  const insertFile = useCallback(async (chosen: File) => {
    const current = editorRef.current;
    if (!current || readOnly) return;
    try {
      const content = /\.docx$/i.test(chosen.name)
        ? docxToDocContent(readDocx(await readDocxParts(await chosen.arrayBuffer())))
        : textToDocContent(await chosen.text());
      current.chain().focus().insertContent(content.content ?? []).run();
      setMessage(`Inserted ${chosen.name}.`);
    } catch {
      setMessage(`${chosen.name} could not be read.`);
    }
  }, [readOnly]);

  // The app's menus and keys reach the document through this.
  useEffect(() => {
    documentCommands.current = {
      undo: () => editorRef.current?.chain().focus().undo().run(),
      redo: () => editorRef.current?.chain().focus().redo().run(),
      find: () => setFinding('find'),
      replace: () => setFinding('replace'),
      findNext: () => setFinding((current) => (current === 'off' ? 'find' : current)),
      pageSetup: () => setTab('layout'),
      print: () => void print(),
      exportPdf: () => void exportPdf(),
      exportDocx: () => void exportDocx(),
      flush: () => flush(editorRef.current),
    };
    return () => {
      documentCommands.current = null;
    };
  }, [print, exportPdf, exportDocx, flush]);

  // Ctrl+H is Word's replace; Ctrl+F is caught by the app's own menu.
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.shiftKey && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setFinding('replace');
      } else if (event.key === 'Escape' && finding !== 'off') {
        setFinding('off');
        editorRef.current?.commands.focus();
      }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [finding]);

  // ------------------------------------------------------- layout

  const { width, height } = pageSize(document.pageSetup);
  const margins = document.pageSetup.margins;
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sheet.current;
    if (!node || view.layout !== 'print') return;
    const measure = () => setPages(Math.max(1, Math.ceil(node.scrollHeight / (height * PX_PER_INCH) - 0.01)));
    measure();
    // Absent where there is no layout to watch (a test's DOM).
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [height, view.layout, editor]);

  const words = useMemo(() => (editor ? docWordCount(editor.getJSON() as DocNode) : 0), [editor, editor?.state.doc]);
  const characters = useMemo(() => (editor ? docPlainText(editor.getJSON() as DocNode).replace(/\n/g, '').length : 0), [editor, editor?.state.doc]);
  const selectedWords = editor && !editor.state.selection.empty
    ? countTextWords(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' '))
    : 0;
  const headings = useMemo(() => (editor ? docHeadings(editor.getJSON() as DocNode) : []), [editor, editor?.state.doc]);

  const jumpTo = (index: number) => {
    if (!editor) return;
    let pos = 0;
    for (let at = 0; at < index && at < editor.state.doc.childCount; at += 1) pos += editor.state.doc.child(at).nodeSize;
    editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
  };

  if (!editor) return null;

  const sheetStyle =
    view.layout === 'print'
      ? {
          width: `${width}in`,
          minHeight: `${height}in`,
          padding: `${margins.top}in ${margins.right}in ${margins.bottom}in ${margins.left}in`,
          // A rule at the foot of every page, so the writer sees where the
          // pages fall. The words are set into pages when printed.
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${height}in - 1px), var(--wp-page-rule) calc(${height}in - 1px), var(--wp-page-rule) ${height}in)`,
        }
      : {};

  return (
    <div className={`wp-workspace${view.marks ? ' show-marks' : ''}`}>
      <style>{DOCUMENT_CONTENT_CSS}</style>
      <Ribbon
        editor={editor}
        tab={tab}
        onTab={setTab}
        pageSetup={document.pageSetup}
        onPageSetup={(patch) => onUpdate((current) => setDocumentPageSetup(current, documentId, patch))}
        file={{ save: () => { flush(editor); onSave(); }, saveAs: () => { flush(editor); onSaveAs(); }, print: () => void print(), exportPdf: () => void exportPdf(), exportDocx: () => void exportDocx(), exportText: () => void exportText(), insertFile: (chosen) => void insertFile(chosen) }}
        view={view}
        onView={(patch) => setView((current) => ({ ...current, ...patch }))}
        onFind={setFinding}
        painting={painter !== null}
        onPaint={startPainter}
        words={words}
        characters={characters}
      />

      {finding !== 'off' ? (
        <form
          className="wp-find"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            goTo(search.current + 1);
          }}
        >
          <input
            autoFocus
            aria-label="Find"
            placeholder="Find in document"
            value={search.query}
            onChange={(event) => setSearch((current) => ({ ...current, query: event.target.value, current: -1 }))}
          />
          <span className="wp-find-count" aria-live="polite">
            {search.query ? (matches.length ? `${search.current >= 0 ? search.current + 1 : 0} of ${matches.length}` : 'No matches') : ''}
          </span>
          <button type="button" onClick={() => goTo(search.current - 1)} disabled={!matches.length} aria-label="Previous match">
            ↑
          </button>
          <button type="submit" disabled={!matches.length} aria-label="Next match">
            ↓
          </button>
          <label>
            <input type="checkbox" checked={search.caseSensitive} onChange={(event) => setSearch((current) => ({ ...current, caseSensitive: event.target.checked, current: -1 }))} /> Match case
          </label>
          <label>
            <input type="checkbox" checked={search.wholeWord} onChange={(event) => setSearch((current) => ({ ...current, wholeWord: event.target.checked, current: -1 }))} /> Whole words
          </label>
          {finding === 'replace' ? (
            <>
              <input aria-label="Replace with" placeholder="Replace with" value={replacement} onChange={(event) => setReplacement(event.target.value)} />
              <button type="button" onClick={replaceOne} disabled={!matches.length || readOnly}>
                Replace
              </button>
              <button type="button" onClick={replaceAll} disabled={!matches.length || readOnly}>
                Replace all
              </button>
            </>
          ) : (
            <button type="button" className="ghost" onClick={() => setFinding('replace')}>
              Replace…
            </button>
          )}
          <button type="button" className="ghost" aria-label="Close find" onClick={() => setFinding('off')}>
            ×
          </button>
        </form>
      ) : null}

      {message ? (
        <p className="notice banner" role="status">
          {message}
          <button type="button" className="ghost" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </p>
      ) : null}

      <div className="wp-body">
        {view.navigation ? (
          <nav className="wp-nav" aria-label="Navigation">
            <h3>Headings</h3>
            {headings.length ? (
              <ul>
                {headings.map((heading) => (
                  <li key={`${heading.index}`} style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}>
                    <button type="button" className="ghost" onClick={() => jumpTo(heading.index)}>
                      {heading.text || '(empty heading)'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Headings you add appear here. Use the Styles box on the Home tab.</p>
            )}
          </nav>
        ) : null}
        <div className={`wp-canvas ${view.layout}`} style={{ zoom: view.zoom } as React.CSSProperties} onMouseDown={(event) => {
          // A press on the grey around the page puts the cursor at the end.
          if (event.target === event.currentTarget) {
            event.preventDefault();
            editor.commands.focus('end');
          }
        }}>
          <div ref={sheet} className="wp-sheet" style={sheetStyle} spellCheck={view.spelling}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      <footer className="wp-status" aria-label="Status">
        {view.layout === 'print' ? <span>{pages === 1 ? '1 page' : `${pages} pages`}</span> : null}
        <span>
          {selectedWords ? `${selectedWords.toLocaleString()} of ${words.toLocaleString()} words` : `${words.toLocaleString()} words`}
        </span>
        <span>{characters.toLocaleString()} characters</span>
        {painter ? <span className="wp-status-note">Format painter: select text to paint</span> : null}
        {readOnly ? <span className="wp-status-note">Read-only</span> : null}
        <span className="wp-status-spacer" />
        <label className="wp-zoom">
          Zoom
          <input
            type="range"
            min={50}
            max={200}
            step={10}
            value={Math.round(view.zoom * 100)}
            aria-label="Zoom"
            onChange={(event) => setView((current) => ({ ...current, zoom: Number(event.target.value) / 100 }))}
          />
          <span>{Math.round(view.zoom * 100)}%</span>
        </label>
        <span className="wp-save">{SAVE_WORDS[saveState] ?? saveState}</span>
      </footer>
    </div>
  );
}
