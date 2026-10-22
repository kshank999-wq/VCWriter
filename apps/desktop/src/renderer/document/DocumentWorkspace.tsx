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
  createExtract,
  deleteExtract,
  documentFromOutline,
  documentOutlineNumbers,
  ensureDocumentOutline,
  extractOfRow,
  findOutline,
  headingOfRow,
  linkExtractToOutline,
  outlineFromDocument,
  numberedPlainText,
  fillFields,
  hasHeaderFooter,
  pageNumberPresetOf,
  printedDate,
  setHeaderFooter,
  setPageNumbers,
  rowReceipts,
  setHeadingNumbering,
  HEADING_NUMBERINGS,
  type HeadingNumbering,
  type OutlineId,
  ensureExtractPalettes,
  isDuplicateExtract,
  newId,
  palettesOf,
  setDocumentContent,
  setDocumentPageSetup,
  textToDocContent,
  type DocNode,
  type Extract,
  type ExtractCategory,
  type ExtractId,
  type ExtractPaletteId,
  type ProjectFile,
  type WpDocument,
  DOCUMENT_CITATION_CSS,
  REFERENCE_STYLE_NAMES,
  bibliographyHtml,
  citationByKey,
  citationSettingsOf,
  citeDocumentHtml,
  documentCitations,
  insertCitation,
  plainInline,
  updateCitation,
} from '@vcwriter/domain';
import { readDocxParts } from '../read-docx';
import { documentExtensions, extractRange, findMatches, headingPosition, type CitationStorage, type SearchState } from './extensions';
import { CitationDialog, type CitationChoice } from '../components/citations/CitationDialog';
import { ReferencesPanel } from '../components/citations/ReferencesPanel';
import { BringInSourcesDialog } from '../components/citations/BringInSourcesDialog';
import { OutlinerWindow } from '../components/OutlinerWindow';
import { SendExtractsDialog, type SendSubject } from './SendExtractsDialog';
import { HeaderFooterBar } from './HeaderFooterBar';
import { useDocumentSpeech } from './speech';
import { ExtractSidebar, type SourceDisplay } from './ExtractSidebar';
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

/** The citations' keys in an editor, in order (addendum 43 §11). */
const citeKeysOf = (editor: Editor | null): string[] => {
  const keys: string[] = [];
  editor?.state.doc.descendants((node) => {
    if (node.type.name === 'citation') keys.push(String(node.attrs['key'] ?? ''));
    return true;
  });
  return keys;
};

interface DocumentWorkspaceProps {
  file: ProjectFile;
  document: WpDocument;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  saveState: string;
  onSave(): void;
  onSaveAs(): void;
  readOnly?: boolean;
  /** Where the open project is kept, so sending extracts does not offer it twice. */
  projectPath?: string | null;
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

export function DocumentWorkspace({ file, document, onUpdate, saveState, onSave, onSaveAs, readOnly = false, projectPath = null }: DocumentWorkspaceProps) {
  const [tab, setTab] = useState<RibbonTab>('home');
  const [view, setView] = useState<ViewState>({ layout: 'print', navigation: false, marks: false, spelling: true, zoom: 1, fit: 'none' });
  const [finding, setFinding] = useState<'off' | 'find' | 'replace'>('off');
  const [search, setSearch] = useState<SearchState>({ query: '', caseSensitive: false, wholeWord: false, current: -1 });
  const [replacement, setReplacement] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [painter, setPainter] = useState<readonly Mark[] | null>(null);
  const [pages, setPages] = useState(1);
  // Extract & Organize (addendum 42 §8).
  const [extracting, setExtracting] = useState(false);
  const [paletteId, setPaletteId] = useState<ExtractPaletteId | null>(null);
  const [display, setDisplay] = useState<SourceDisplay>('normal');
  const [extractNotice, setExtractNotice] = useState<string | null>(null);
  // The Outliner tab (addendum 42 §9), and extracts on their way to a project (§10).
  const [pane, setPane] = useState<'document' | 'outliner'>('document');
  const [sending, setSending] = useState<SendSubject | null>(null);
  // Headers, footers and page numbers (addendum 42 §15).
  const [headerFooterOpen, setHeaderFooterOpen] = useState(false);
  // Citations and the Reference Library (addendum 43 §11): the dialog for a
  // citation (its key, or null to insert one), the library, and bringing in.
  const [citing, setCiting] = useState<{ key: string | null } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [bringing, setBringing] = useState(false);

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
      if (readOnly) return;
      // The outline follows the headings (addendum 42 §9); with no outline yet this changes nothing.
      onUpdate((current) => outlineFromDocument(setDocumentContent(current, documentId, content), documentId));
    },
    [documentId, onUpdate, readOnly],
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
      // Insert Citation, on the key the manuscript uses (addendum 43 §4).
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c' && !readOnly) {
          event.preventDefault();
          setCiting({ key: null });
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => flush(current), SETTLE_MS);
    },
  });

  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  // Dictate and read aloud (addendum 42 §15).
  const speech = useDocumentSpeech(editor, setMessage);

  // ------------------------------------------------------- citations

  /**
   * The citations as the editor holds them now, in order (addendum 43 §11).
   * Read off the editor rather than the project, which takes the tree a
   * moment after typing settles — a marker drawn from that would be the
   * order of a moment ago.
   */
  const citeKeys: string[] = [];
  editor?.state.doc.descendants((node) => {
    if (node.type.name === 'citation') citeKeys.push(String(node.attrs['key'] ?? ''));
    return node.isBlock || node.type.name === 'doc';
  });
  const citeOrder = citeKeys.join(' ');
  /** The project with this document's citations in the editor's order: all the reading needs. */
  const withEditorOrder = useCallback(
    (current: ProjectFile, keys: readonly string[]): ProjectFile => ({
      ...current,
      documents: current.documents.map((one) =>
        one.id === documentId ? { ...one, content: { type: 'doc', content: keys.map((key) => ({ type: 'citation', attrs: { key } })) } } : one,
      ),
    }),
    [documentId],
  );
  const cites = useMemo(
    () => documentCitations(withEditorOrder(file, citeOrder ? citeOrder.split(' ') : []), documentId),
    // The library, the citations, the style and the order are all it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [citeOrder, file.references, file.citations, file.settings.citations, documentId, withEditorOrder],
  );

  useEffect(() => {
    if (!editor) return;
    const markers = new Map<string, string>();
    for (const occurrence of cites.occurrences) {
      if (markers.has(occurrence.key)) continue;
      markers.set(occurrence.key, occurrence.citation && occurrence.reference ? plainInline(cites.inText.get(occurrence.key) ?? '') : '');
    }
    editor.commands.setCitationView({ markers, raised: cites.raised, bibliographyHtml: bibliographyHtml(cites) });
  }, [editor, cites]);

  useEffect(() => {
    if (!editor) return undefined;
    const storage = (editor.storage as unknown as { citation: CitationStorage }).citation;
    storage.onOpen = readOnly ? null : (key) => setCiting({ key });
    return () => {
      storage.onOpen = null;
    };
  }, [editor, readOnly]);

  /** The dialog's choice: a new citation at the cursor, or the one opened changed. */
  const placeCitation = (choice: CitationChoice) => {
    const opened = citing?.key ? citationByKey(file, citing.key) : null;
    if (opened) {
      onUpdate((current) => updateCitation(current, opened.id, choice));
    } else {
      const made = insertCitation(file, choice);
      // A citation whose record had gone takes the new record under its own
      // key, so the marker in the text stands where it stood.
      const record = citing?.key ? { ...made.citation, key: citing.key } : made.citation;
      onUpdate((current) => ({ ...current, citations: [...current.citations, record] }));
      if (!citing?.key) editor?.chain().focus().insertCitation(record.key).run();
    }
    setCiting(null);
  };

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

  // Heading numbers are drawn on the page, never typed into it.
  useEffect(() => {
    editor?.commands.setHeadingNumbering(document.headingNumbering);
  }, [editor, document.headingNumbering]);

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

  /** This document's citations as print and Word set them, from the editor as it stands. */
  const citesNow = useCallback(() => documentCitations(withEditorOrder(file, citeKeysOf(editorRef.current)), documentId), [file, documentId, withEditorOrder]);

  const printable = useCallback(() => {
    const current = docOf();
    return {
      html: documentPrintHtml(current, citeDocumentHtml(citesNow(), editorRef.current?.getHTML() ?? '')),
      paper: pageSize(current.pageSetup),
    };
  }, [docOf, citesNow]);

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
    const bytes = await buildDocumentDocx(docOf(), { author: file.project.author ?? '', citations: citesNow() });
    const result = await download(`${baseName}.docx`, bytes, DOCX_MEDIA_TYPE, { name: 'Word document', extension: 'docx' });
    if (!result.ok) setMessage(result.error ?? 'The Word file could not be saved');
    else if (result.data?.path) setMessage(`Saved ${result.data.path}`);
  }, [docOf, file.project.author, baseName, citesNow]);

  const exportText = useCallback(async () => {
    // With the heading numbers in front, as the page shows them (addendum 42 §14).
    const text = numberedPlainText(docOf());
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
    // The words' own height and the margins, not the sheet's: the sheet is
    // drawn at a whole number of pages, so measuring it would never shrink.
    const measure = () => {
      const words = (node.querySelector('.ProseMirror') as HTMLElement | null)?.offsetHeight ?? node.scrollHeight;
      const used = words + (margins.top + margins.bottom) * PX_PER_INCH;
      setPages(Math.max(1, Math.ceil(used / (height * PX_PER_INCH) - 0.01)));
    };
    measure();
    // Absent where there is no layout to watch (a test's DOM).
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [height, view.layout, editor, margins.top, margins.bottom, editor?.state.doc]);

  // Zoom that follows the window: the whole page, or its width.
  const canvas = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node || view.fit === 'none' || view.layout !== 'print') return;
    const fit = () => {
      // Measured on the canvas's parent, which is not zoomed: the canvas's own
      // size is in its zoomed pixels, so reading it would chase its own tail.
      const body = node.parentElement;
      if (!body) return;
      const beside = [...body.children].filter((child) => child !== node).reduce((sum, child) => sum + (child as HTMLElement).offsetWidth, 0);
      const room = { width: body.clientWidth - beside - 48, height: body.clientHeight - 48 };
      if (room.width <= 0 || room.height <= 0) return;
      const page = { width: width * PX_PER_INCH, height: height * PX_PER_INCH };
      const zoom = view.fit === 'page' ? Math.min(room.width / page.width, room.height / page.height) : room.width / page.width;
      const rounded = Math.max(0.25, Math.min(3, Math.round(zoom * 100) / 100));
      setView((current) => (current.zoom === rounded ? current : { ...current, zoom: rounded }));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    if (node.parentElement) observer.observe(node.parentElement);
    return () => observer.disconnect();
  }, [view.fit, view.layout, width, height, view.navigation, extracting]);

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

  // General Writing is there the first time the sidebar opens.
  useEffect(() => {
    if (extracting && !readOnly && !file.extractPalettes.some((palette) => palette.builtIn === 'general_writing')) {
      onUpdate(ensureExtractPalettes);
    }
  }, [extracting, readOnly, file.extractPalettes, onUpdate]);

  /**
   * One press, one extract (WP spec §5.1 step 4): the passage is marked in
   * the page and its copy goes into the bin in the **same** change to the
   * project, so the two cannot be saved apart.
   */
  const capture = (category: ExtractCategory) => {
    if (!editor || readOnly) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      setExtractNotice('Select text first.');
      return;
    }
    const textPlain = editor.state.doc.textBetween(from, to, '\n', '\uFFFC').trim();
    if (!textPlain) {
      setExtractNotice('That selection has no words in it.');
      return;
    }
    if (isDuplicateExtract(file, { documentId, categoryId: category.id, textPlain })) {
      setExtractNotice(`That passage is already in ${category.label}.`);
      return;
    }
    const id = newId<ExtractId>();
    const textRich = editor.state.doc.slice(from, to).content.toJSON() as DocNode[];
    const mark = editor.schema.marks['extract']!.create({ id, color: category.color, label: category.label });
    // Not an edit to the writing, so not in its undo: Ctrl+Z after a capture
    // takes back the last thing typed, not the mark.
    editor.view.dispatch(editor.state.tr.addMark(from, to, mark).setMeta('addToHistory', false));
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const content = editor.getJSON() as DocNode;
    pushed.current = content;
    pushedJson.current = JSON.stringify(content);
    onUpdate((current) =>
      createExtract(setDocumentContent(current, documentId, content), {
        id,
        documentId,
        categoryId: category.id,
        textPlain,
        textRich,
        sourceRevision: document.revision + 1,
      }).file,
    );
    const count = file.extracts.filter((extract) => extract.categoryId === category.id).length + 1;
    setExtractNotice(`Added to ${category.label} (${count}).`);
  };

  /**
   * Take these extracts' marks off the page, and say what the page is now —
   * or null where none of them was marked. The words are untouched.
   */
  const stripMarks = (ids: ReadonlySet<string>): DocNode | null => {
    if (!editor || ids.size === 0) return null;
    const type = editor.schema.marks['extract']!;
    const { tr } = editor.state;
    editor.state.doc.descendants((node, pos) => {
      node.marks.forEach((mark) => {
        if (mark.type === type && ids.has(String(mark.attrs['id']))) tr.removeMark(pos, pos + node.nodeSize, mark);
      });
      return true;
    });
    if (!tr.docChanged) return null;
    editor.view.dispatch(tr.setMeta('addToHistory', false));
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const content = editor.getJSON() as DocNode;
    pushed.current = content;
    pushedJson.current = JSON.stringify(content);
    return content;
  };

  /** The copy and its mark go; the words stay in the document. */
  const removeExtract = (extract: Extract) => {
    if (!editor || readOnly) return;
    const content = stripMarks(new Set([extract.id]));
    onUpdate((current) => deleteExtract(content ? setDocumentContent(current, documentId, content) : current, extract.id));
  };

  /** What the destination dialog sent, recorded here; a move also takes the marks off the page. */
  const finishSend = (apply: (current: ProjectFile) => ProjectFile, moved: string[], said: string) => {
    const content = stripMarks(new Set(moved));
    onUpdate((current) => apply(content ? setDocumentContent(current, documentId, content) : current));
    // Rows are sent from the Outliner, where the sidebar's notice is out of sight.
    if (sending?.kind === 'rows') setMessage(said);
    else setExtractNotice(said);
    setSending(null);
  };

  const addToOutline = (extract: Extract) => {
    if (readOnly) return;
    flush(editor);
    const done = linkExtractToOutline(file, documentId, extract.id);
    onUpdate((current) => linkExtractToOutline(current, documentId, extract.id).file);
    setExtractNotice(done.existed ? 'That extract is already in the outline.' : 'Added to the outline.');
  };

  // ------------------------------------------------------ the outliner

  const outlineId = document.outlineId && findOutline(file, document.outlineId as OutlineId) ? document.outlineId : null;

  const openOutliner = () => {
    flush(editor);
    if (!outlineId && !readOnly) onUpdate((current) => ensureDocumentOutline(current, documentId).file);
    setPane('outliner');
  };

  /** A change made in the Outliner, carried into the document's headings. */
  const updateFromOutline = useCallback(
    (mutate: (current: ProjectFile) => ProjectFile) => onUpdate((current) => documentFromOutline(mutate(current), documentId)),
    [onUpdate, documentId],
  );

  const outlineNumbers = useMemo(() => documentOutlineNumbers(document), [document]);

  /** A double-click on a row: to its heading, or to the passage it was extracted from. */
  const openRow = (itemId: string) => {
    if (!editor) return;
    const headingId = headingOfRow(document, itemId);
    const extractId = extractOfRow(document, itemId);
    const at = headingId ? headingPosition(editor.state.doc, headingId) : null;
    const range = extractId ? extractRange(editor.state.doc, extractId) : null;
    if (at === null && range === null) return;
    setPane('document');
    // After the page is shown again, so it can scroll.
    window.setTimeout(() => {
      if (at !== null) editor.chain().focus().setTextSelection(at).scrollIntoView().run();
      else if (range) editor.chain().focus().setTextSelection(range).scrollIntoView().run();
    }, 0);
  };

  const reveal = (extract: Extract) => {
    if (!editor) return;
    const range = extractRange(editor.state.doc, extract.id);
    if (range) editor.chain().focus().setTextSelection(range).scrollIntoView().run();
  };

  if (!editor) return null;

  const sheetStyle =
    view.layout === 'print'
      ? {
          width: `${width}in`,
          minHeight: `${height * pages}in`,
          position: 'relative' as const,
          padding: `${margins.top}in ${margins.right}in ${margins.bottom}in ${margins.left}in`,
          // A rule at the foot of every page, so the writer sees where the
          // pages fall. The words are set into pages when printed.
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${height}in - 1px), var(--wp-page-rule) calc(${height}in - 1px), var(--wp-page-rule) ${height}in)`,
        }
      : {};

  return (
    <div className={`wp-workspace${view.marks ? ' show-marks' : ''} extracts-${display}`}>
      <style>{DOCUMENT_CONTENT_CSS + DOCUMENT_CITATION_CSS}</style>
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
        extracting={extracting}
        onExtracting={() => setExtracting((current) => !current)}
        headerFooter={{
          open: headerFooterOpen,
          onToggle: () => setHeaderFooterOpen((current) => !current),
          pageNumbers: pageNumberPresetOf(document),
          onPageNumbers: (preset) => onUpdate((current) => setPageNumbers(current, documentId, preset)),
        }}
        speech={speech}
        references={{
          style: REFERENCE_STYLE_NAMES[citationSettingsOf(file).style],
          cited: cites.occurrences.length,
          library: file.references.filter((one) => one.archivedAt === null).length,
          onCite: () => !readOnly && setCiting({ key: null }),
          onBibliography: () => !readOnly && editor?.chain().focus().insertBibliography().run(),
          onLibrary: () => setLibraryOpen(true),
          onBringIn: () => !readOnly && setBringing(true),
        }}
        onSay={setMessage}
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

      {headerFooterOpen ? (
        <HeaderFooterBar
          value={document.headerFooter}
          readOnly={readOnly}
          onChange={(patch) => onUpdate((current) => setHeaderFooter(current, documentId, patch))}
          onClose={() => setHeaderFooterOpen(false)}
        />
      ) : null}

      <div className="wp-panes" role="tablist" aria-label="View">
        <button type="button" role="tab" aria-selected={pane === 'document'} className={pane === 'document' ? 'on' : ''} onClick={() => setPane('document')}>
          Document
        </button>
        <button type="button" role="tab" aria-selected={pane === 'outliner'} className={pane === 'outliner' ? 'on' : ''} onClick={openOutliner}>
          Outliner
        </button>
      </div>

      {message ? (
        <p className="notice banner" role="status">
          {message}
          <button type="button" className="ghost" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </p>
      ) : null}

      {pane === 'outliner' && outlineId ? (
        <div className="wp-outliner">
          <OutlinerWindow
            file={file}
            open
            page
            onClose={() => setPane('document')}
            onUpdate={updateFromOutline}
            outlineId={outlineId}
            promotion={false}
            numbers={outlineNumbers}
            onOpenRow={(item) => openRow(item.id as string)}
            rowDetail={(item) => {
              const sent = rowReceipts(document, item.id as string);
              return sent.length ? (
                <ul className="wp-row-sent" aria-label="Sent to">
                  {sent.map((receipt) => (
                    <li key={`${receipt.projectId}-${receipt.resultId}-${receipt.at}`} title={receipt.path ?? undefined}>
                      Sent to {receipt.projectTitle || 'a project'} › {receipt.areaName}
                    </li>
                  ))}
                </ul>
              ) : null;
            }}
            onSendRows={
              readOnly
                ? undefined
                : (items) => {
                    flush(editor);
                    setSending({
                      kind: 'rows',
                      documentId,
                      itemIds: items.map((item) => item.id as string),
                      titles: items.map((item) => item.title),
                    });
                  }
            }
            toolbar={
              <label className="wp-numbering">
                Numbering
                <select
                  aria-label="Heading numbering"
                  value={document.headingNumbering}
                  disabled={readOnly}
                  onChange={(event) => onUpdate((current) => setHeadingNumbering(current, documentId, event.target.value as HeadingNumbering))}
                >
                  {HEADING_NUMBERINGS.map((one) => (
                    <option key={one.value} value={one.value}>
                      {one.name}
                    </option>
                  ))}
                </select>
              </label>
            }
          />
        </div>
      ) : null}

      <div className="wp-body" hidden={pane === 'outliner'}>
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
        <div ref={canvas} className={`wp-canvas ${view.layout}`} style={{ zoom: view.zoom } as React.CSSProperties} onMouseDown={(event) => {
          // A press on the grey around the page puts the cursor at the end.
          if (event.target === event.currentTarget) {
            event.preventDefault();
            editor.commands.focus('end');
          }
        }}>
          <div ref={sheet} className="wp-sheet" style={sheetStyle} spellCheck={view.spelling}>
            {view.layout === 'print' && hasHeaderFooter(document) ? (
              <PageBands
                document={document}
                pages={pages}
                pageHeight={height}
                onOpen={() => setHeaderFooterOpen(true)}
              />
            ) : null}
            <EditorContent editor={editor} />
          </div>
        </div>
        {extracting && palettesOf(file).length ? (
          <ExtractSidebar
            file={file}
            document={document}
            editor={editor}
            onUpdate={onUpdate}
            paletteId={paletteId}
            onPalette={(id) => {
              setPaletteId(id);
              setExtractNotice(null);
            }}
            onCapture={capture}
            onRemove={removeExtract}
            onReveal={reveal}
            onSend={(extracts) => {
              flush(editor);
              setSending({ kind: 'extracts', extracts });
            }}
            onAddToOutline={addToOutline}
            display={display}
            onDisplay={setDisplay}
            onClose={() => setExtracting(false)}
            readOnly={readOnly}
            notice={extractNotice}
          />
        ) : null}
      </div>

      {citing ? (
        <CitationDialog
          file={withEditorOrder(file, citeKeys)}
          onUpdate={onUpdate}
          citation={citing.key ? citationByKey(file, citing.key) : null}
          missingKey={citing.key && !citationByKey(file, citing.key) ? citing.key : null}
          documentId={documentId}
          onDone={placeCitation}
          onRemove={
            citing.key
              ? () => {
                  editor?.commands.removeCitation(citing.key as string);
                  setCiting(null);
                }
              : undefined
          }
          onClose={() => setCiting(null)}
        />
      ) : null}
      {libraryOpen ? (
        <div className="cite-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setLibraryOpen(false)}>
          <div className="cite-dialog refs-modal" role="dialog" aria-modal="true" aria-label="Sources and style">
            <header>
              <h2>Sources &amp; style</h2>
              <button type="button" className="ghost" aria-label="Close" onClick={() => setLibraryOpen(false)}>
                ×
              </button>
            </header>
            <ReferencesPanel file={withEditorOrder(file, citeKeys)} onUpdate={onUpdate} readOnly={readOnly} documentId={documentId} projectPath={projectPath} />
          </div>
        </div>
      ) : null}
      {bringing ? <BringInSourcesDialog file={file} projectPath={projectPath} onUpdate={onUpdate} onClose={() => setBringing(false)} /> : null}

      {sending ? (
        <SendExtractsDialog
          file={file}
          projectPath={projectPath}
          subject={sending}
          onClose={() => setSending(null)}
          onSent={finishSend}
        />
      ) : null}

      <footer className="wp-status" aria-label="Status">
        {view.layout === 'print' ? <span>{pages === 1 ? '1 page' : `${pages} pages`}</span> : null}
        <span>
          {selectedWords ? `${selectedWords.toLocaleString()} of ${words.toLocaleString()} words` : `${words.toLocaleString()} words`}
        </span>
        <span>{characters.toLocaleString()} characters</span>
        {painter ? <span className="wp-status-note">Format painter: select text to paint</span> : null}
        {readOnly ? <span className="wp-status-note">Read-only</span> : null}
        {speech.dictating ? (
          <span className="wp-status-note wp-dictating" role="status">
            Dictating{speech.heard ? `: ${speech.heard}` : '…'}
          </span>
        ) : null}
        {speech.reading ? <span className="wp-status-note" role="status">Reading aloud</span> : null}
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
            onChange={(event) => setView((current) => ({ ...current, zoom: Number(event.target.value) / 100, fit: 'none' }))}
          />
          <span>{Math.round(view.zoom * 100)}%</span>
        </label>
        <button
          type="button"
          className={`ghost small wp-fit${view.fit === 'page' ? ' on' : ''}`}
          title="One page: the whole page in the window"
          aria-pressed={view.fit === 'page'}
          onClick={() => setView((current) => ({ ...current, fit: 'page', layout: 'print' }))}
        >
          One page
        </button>
        <button
          type="button"
          className={`ghost small wp-fit${view.fit === 'width' ? ' on' : ''}`}
          title="Page width: the page as wide as the window"
          aria-pressed={view.fit === 'width'}
          onClick={() => setView((current) => ({ ...current, fit: 'width', layout: 'print' }))}
        >
          Page width
        </button>
        <span className="wp-save">{SAVE_WORDS[saveState] ?? saveState}</span>
      </footer>
    </div>
  );
}

/**
 * The header on the first page and the footer on the last, drawn in their
 * margins with the fields filled in (addendum 42 §15). The screen is one long
 * sheet, not set into pages, so the bands of the pages between are left to the
 * printed page, where the browser sets each one exactly. A double-click opens
 * the bar to change them, as in Word.
 */
function PageBands({
  document,
  pages,
  pageHeight,
  onOpen,
}: {
  document: WpDocument;
  pages: number;
  pageHeight: number;
  onOpen(): void;
}) {
  const { header, footer, firstPage } = document.headerFooter;
  const values = { pages, title: document.title || '', date: printedDate() };
  const margins = document.pageSetup.margins;
  const band = (slots: typeof header, page: number) =>
    (['left', 'center', 'right'] as const).map((slot) => (
      <span key={slot} className={`wp-band-slot ${slot}`}>
        {fillFields(slots[slot], { ...values, page })}
      </span>
    ));
  const showHeader = firstPage && Object.values(header).some((text) => text.trim());
  const showFooter = (firstPage || pages > 1) && Object.values(footer).some((text) => text.trim());
  return (
    <>
      {showHeader ? (
        <div
          className="wp-band header"
          style={{ top: `${margins.top / 2}in`, left: `${margins.left}in`, right: `${margins.right}in` }}
          title="Header: double-click to change"
          onDoubleClick={onOpen}
          aria-label="Header"
        >
          {band(header, 1)}
        </div>
      ) : null}
      {showFooter ? (
        <div
          className="wp-band footer"
          style={{ top: `${pages * pageHeight - margins.bottom / 2}in`, left: `${margins.left}in`, right: `${margins.right}in` }}
          title="Footer: double-click to change"
          onDoubleClick={onOpen}
          aria-label="Footer"
        >
          {band(footer, pages)}
        </div>
      ) : null}
    </>
  );
}
