import { useMemo, useRef, useState } from 'react';
import {
  ALL_CHAPTER_MARKS,
  appendImportedEpisode,
  appendImportedStory,
  buildProjectFromImport,
  CHAPTER_MARKS,
  defaultSplit,
  describeMarks,
  docxToImport,
  ensureFirstEpisode,
  formatForKind,
  isCollection,
  isProseFormat,
  landsInLayout,
  nounsFor,
  readDocx,
  readFinalDraft,
  readLaidOutLines,
  textToProse,
  type ChapterMarks,
  type DocxDocument,
  type ImportKind,
  type PassageSplit,
  type ImportedCharacter,
  type ImportedLocation,
  type ImportedScene,
  type ImportedScript,
  type ProjectFile,
  type ProjectFormat,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';
import { late } from '../late-module';
import { readDocxParts } from '../read-docx';
import { bareName, countOf, shifted } from '../read-import';

/**
 * Importing somebody else's script (addendum 02 §18).
 *
 * The dialog reads the file, then **shows what it found before it makes
 * anything**: how many scenes, who is in it and how much each of them
 * speaks, where it happens, and whatever the reader was unsure of. An
 * importer that goes straight to a finished project asks the writer to
 * audit a hundred pages to find out whether it worked.
 *
 * Three readers behind it. A Final Draft document says what every line is, so
 * nothing is guessed. A PDF says only where each line sits — which in a
 * screenplay is very nearly as good, because the format is the indentation —
 * and anything it had to work out from shape is counted and said. A Word
 * document (addendum 21) is read by its headings for a book and by its
 * indents for a script, so what it is read *as* follows the format chosen
 * here — the document is kept and read again when the format changes.
 *
 * **Several files at once** (addendum 22 §4a): a series or a collection is
 * made of parts that arrive as separate documents, so on those two formats
 * the first file makes the project and each file after it is appended as
 * the next episode or story, on a page of its own, in the order listed —
 * which is the order chosen, or the order the arrows put them in. On any
 * other format a project is one document, and the rest are said to be left
 * out rather than silently dropped.
 */

interface ImportDialogProps {
  open: boolean;
  /**
   * What is being imported, chosen before the file (addendum 33). It decides
   * the title, which files are offered, which format is made and which
   * controls there are — so a writer bringing in a novel never meets a screen
   * about screenplays, and the format select that used to decide it is absent
   * on every kind that already said.
   */
  kind: ImportKind;
  onClose(): void;
  /** Adopt the built project. It arrives unsaved: the writer says where. */
  onImported(file: ProjectFile): void;
}

/** A file as read: once, as a script; or a Word document, read for whichever format is chosen. */
type Source =
  | { kind: 'script'; script: ImportedScript }
  | { kind: 'word'; doc: DocxDocument; title: string }
  /** Plain text, kept as text so it can be read again when the marks change. */
  | { kind: 'text'; text: string; title: string };

interface Part {
  name: string;
  source: Source;
}

type Stage =
  | { kind: 'waiting' }
  | { kind: 'reading'; count: number }
  | { kind: 'read'; parts: Part[]; failed: string[] }
  | { kind: 'failed'; message: string };

const FORMATS: ReadonlyArray<{ value: ProjectFormat; label: string }> = [
  { value: 'screenplay', label: 'Screenplay' },
  { value: 'series', label: 'Series or episodic' },
  { value: 'stage_play', label: 'Stage play' },
  { value: 'short_form', label: 'Short form' },
];

/** Only a Word document can come in as a book: a PDF's lines say where, not what. */
const PROSE_FORMATS: ReadonlyArray<{ value: ProjectFormat; label: string }> = [
  { value: 'novel', label: 'Novel' },
  { value: 'short_story', label: 'Short stories and collections' },
  { value: 'instructional', label: 'Instructional or textbook' },
];

/**
 * What a part reads as, for the format it is going into and the marks that
 * are on. **Re-read rather than counted**: turning a mark off and watching
 * the chapter figure move is the document answering, where an estimate would
 * be this screen guessing about somebody else's manuscript.
 */
const scriptOf = (part: Part, format: ProjectFormat, marks: ChapterMarks): ImportedScript => {
  if (part.source.kind === 'script') return part.source.script;
  if (part.source.kind === 'text') return textToProse(part.source.text, { title: part.source.title, marks });
  return docxToImport(part.source.doc, format, { title: part.source.title, marks });
};

/**
 * A file read for the kind being imported.
 *
 * **The kind decides what may be read, and the reader says so rather than
 * only the picker.** `accept` is a filter the file dialog applies and a
 * renamed file walks straight past, so a plain-text file offered as a script
 * has to be refused here — a `.txt` has no indents to read a screenplay's
 * format out of, and reading one as prose because it is prose-shaped would be
 * the dialog deciding what the writer came to import.
 */
const readPart = async (chosen: File, prose: boolean): Promise<Part> => {
  if (prose) {
    if (/\.(txt|md|markdown|text)$/i.test(chosen.name)) {
      return { name: chosen.name, source: { kind: 'text', text: await chosen.text(), title: bareName(chosen.name) } };
    }
    if (/\.docx$/i.test(chosen.name)) {
      const doc = readDocx(await readDocxParts(await chosen.arrayBuffer()));
      return { name: chosen.name, source: { kind: 'word', doc, title: bareName(chosen.name) } };
    }
    throw new Error('That is not a Word document or a text file. Those are the two this reads.');
  }
  if (/\.fdx$/i.test(chosen.name)) {
    return { name: chosen.name, source: { kind: 'script', script: readFinalDraft(await chosen.text()) } };
  }
  if (/\.docx$/i.test(chosen.name)) {
    // Unzipped by the host, read by the domain (addendum 21 §2).
    const doc = readDocx(await readDocxParts(await chosen.arrayBuffer()));
    return { name: chosen.name, source: { kind: 'word', doc, title: bareName(chosen.name) } };
  }
  if (/\.pdf$/i.test(chosen.name)) {
    // Loaded only when a PDF is actually chosen (addendum 33 §9).
    const { readPdfLines } = await late(() => import('../read-pdf'));
    const { lines, title } = await readPdfLines(await chosen.arrayBuffer());
    return { name: chosen.name, source: { kind: 'script', script: readLaidOutLines(lines, { title: title || bareName(chosen.name) }) } };
  }
  throw new Error('That is not a Final Draft document, a Word document or a PDF. Those are the three this reads.');
};

/** A format that is made of parts, each of which may arrive as its own file. */
const takesSeveral = (format: ProjectFormat): boolean => format === 'series' || isCollection(format);

/** What the kind is called at the top, and which files it will read. */
const WORDS: Record<string, { title: string; picker: string; accept: string; explain: string }> = {
  script: {
    picker: 'Script file',
    title: 'Import a script',
    accept: '.fdx,.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    explain:
      'A Final Draft document (.fdx), a Word document (.docx) or a PDF. Final Draft says what every line is, so nothing is guessed. A Word document is read by its indents and a PDF by where each line sits on the page — which is what a screenplay’s format actually is — and anything worked out that way is marked. Choose several to bring in a series one episode after another.',
  },
  novel: {
    picker: 'Manuscript file',
    title: 'Import a novel',
    accept: '.docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
    explain:
      'A Word document (.docx) or plain text, as one manuscript. A Word document keeps its formatting — the face and size each paragraph was set in. Once it is read you say where the chapters fall, before anything is made.',
  },
  instructional: {
    picker: 'Book file',
    title: 'Import an instructional book',
    accept: '.docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
    explain:
      'A Word document (.docx) or plain text. Its headings become sections, its pictures become figures, and the face and size each paragraph was set in are kept.',
  },
  collection: {
    picker: 'Story files',
    title: 'Import a collection of short stories',
    accept: '.docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
    explain:
      // Deliberately naming no unit: the figures and the sentence under the
      // marks both read the noun table, and a third word here would be a
      // third answer to what was found (addendum 16 §6c).
      'One document per story, chosen all at once or added a file at a time. Once they are read you put them in order and say where each story divides. Every story opens on a page of its own.',
  },
};

export function ImportDialog({ open, kind, onClose, onImported }: ImportDialogProps) {
  const dialog = useModal(open);
  const picker = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'waiting' });
  const [format, setFormat] = useState<ProjectFormat>(formatForKind(kind) ?? 'screenplay');
  // Which of the four signals divides the document (addendum 33), and how
  // much of a chapter goes in a beat. Both start where the format says.
  const [marks, setMarks] = useState<ChapterMarks>(ALL_CHAPTER_MARKS);
  const [split, setSplit] = useState<PassageSplit>(() => defaultSplit(formatForKind(kind) ?? 'screenplay'));
  const [fileCast, setFileCast] = useState(true);
  const [keepLocations, setKeepLocations] = useState(true);
  // One story or many (addendum 22 §2): only the short-story format asks.
  const [stories, setStories] = useState<'one' | 'many'>('one');

  const parts = stage.kind === 'read' ? stage.parts : [];
  // What was read, as the format it is going into: the first file, which
  // is the one the project is made from.
  const script = useMemo<ImportedScript | null>(
    () => (parts[0] ? scriptOf(parts[0], format, marks) : null),
    [parts, format, marks],
  );
  const prose = isProseFormat(format);
  // The kind already said what this is, so the only format question left is
  // *which* script — and on a book there is none at all.
  const formats = prose ? PROSE_FORMATS : FORMATS;
  const words = WORDS[kind] ?? WORDS['script']!;
  // **What will be made, rather than how many headings there are.** With
  // every mark off a manuscript has no headed scene and is still one chapter,
  // and the figure reading 0 over a document about to arrive whole is the
  // screen disagreeing with the import an inch below it. This is
  // `materialiseScenes`' own filter; a script keeps counting its sluglines,
  // a slugline being a heading rather than a unit.
  const chapters = script
    ? prose
      ? script.scenes.filter((scene) => scene.heading.trim().length > 0 || scene.elements.length > 0).length
      : script.scenes.filter((scene) => scene.heading.trim().length > 0).length
    : 0;

  const read = async (chosen: FileList) => {
    const files = Array.from(chosen);
    setStage({ kind: 'reading', count: files.length });
    const read: Part[] = [];
    const failed: string[] = [];
    for (const one of files) {
      try {
        read.push(await readPart(one, prose));
      } catch (error) {
        const message = error instanceof Error ? error.message : `${one.name} could not be read.`;
        failed.push(files.length === 1 ? message : `${one.name}: ${message}`);
      }
    }
    if (read.length === 0) {
      setStage({ kind: 'failed', message: failed[0] ?? 'That file could not be read.' });
      return;
    }
    setStage({ kind: 'read', parts: read, failed });
  };

  const move = (index: number, by: -1 | 1) => {
    if (stage.kind !== 'read') return;
    setStage({ ...stage, parts: shifted(stage.parts, index, by) });
  };

  const drop = (index: number) => {
    if (stage.kind !== 'read') return;
    const left = stage.parts.filter((_part, at) => at !== index);
    setStage(left.length === 0 ? { kind: 'waiting' } : { ...stage, parts: left });
  };

  const finish = () => {
    if (!script || stage.kind !== 'read') return;
    let built = buildProjectFromImport(script, { format, fileCast, keepLocations, stories, passages: split }).file;
    // A series' first script is its first episode, on a page of its own,
    // so that what follows is the second (addendum 22 §4a).
    if (format === 'series') built = ensureFirstEpisode(built, { title: script.title || bareName(stage.parts[0]!.name) });
    if (takesSeveral(format)) {
      for (const part of stage.parts.slice(1)) {
        const next = scriptOf(part, format, marks);
        const title = next.title || bareName(part.name);
        const added = format === 'series' ? appendImportedEpisode(built, next, { title }) : appendImportedStory(built, next, { title });
        if (added) built = added.file;
      }
    }
    onImported(built);
    setStage({ kind: 'waiting' });
    onClose();
  };

  const close = () => {
    setStage({ kind: 'waiting' });
    onClose();
  };

  const nouns = nounsFor(format);
  const partNoun = format === 'series' ? 'episode' : isCollection(format) ? 'story' : null;
  // The noun table calls a series' work a script, which is true of each
  // episode and not of what the files together make.
  const wholeNoun = format === 'series' ? 'series' : nouns.work.toLowerCase();

  return (
    <dialog ref={dialog} className="track-dialog import-dialog" aria-label={words.title} onClose={close}>
      {open ? (
        <>
          <header className="track-dialog-title">
            <span className="bar-title">{words.title}</span>
            <button type="button" className="ghost" aria-label="Close" onClick={close}>
              ×
            </button>
          </header>

          <div className="page-setup-body">
            <input
              ref={picker}
              type="file"
              multiple
              accept={words.accept}
              aria-label={words.picker}
              className="import-picker"
              onChange={(event) => {
                if (event.target.files && event.target.files.length > 0) void read(event.target.files);
              }}
            />

            {stage.kind === 'waiting' ? <p className="muted">{words.explain}</p> : null}

            {stage.kind === 'reading' ? (
              <p className="muted">Reading {stage.count === 1 ? 'the document' : `${stage.count} documents`}…</p>
            ) : null}

            {stage.kind === 'failed' ? (
              <p className="error" role="alert">
                {stage.message}
              </p>
            ) : null}

            {script ? (
              <Found script={script} prose={prose} divisions={chapters} divisionWord={nouns.unitPlural} />
            ) : null}

            {script ? (
              <>
                <h4>What to make of it</h4>
                {/* **Only where there is still a question.** The kind chosen
                    at the door said a novel is a novel; what it did not say
                    is which of the four kinds of script this is, so that is
                    the one format control left (addendum 33). */}
                {prose && kind !== 'collection' ? null : (
                  <label className="field">
                    Format
                    <select
                      aria-label="Format"
                      value={format}
                      onChange={(event) => {
                        const next = event.target.value as ProjectFormat;
                        setFormat(next);
                        setSplit(defaultSplit(next));
                      }}
                    >
                      {formats.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {/* Where the chapters fall, and how much of one is in a beat
                    (addendum 33). Both are a book's alone: a script's scene
                    is its own division and has been one beat since the
                    importer was written. */}
                {prose ? (
                  <>
                    <fieldset className="import-marks">
                      <legend>Divide it at</legend>
                      {CHAPTER_MARKS.map((mark) => (
                        <label className="check" key={mark.id}>
                          <input
                            type="checkbox"
                            aria-label={mark.label}
                            checked={marks[mark.id]}
                            onChange={(event) => setMarks({ ...marks, [mark.id]: event.target.checked })}
                          />
                          <span>
                            {mark.label}
                            <span className="import-mark-note">{mark.note}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    {/* Said in words, and read off the document rather than
                        estimated: turning one off moves the chapter figure
                        above. */}
                    <p className="muted small" role="status">
                      {describeMarks(marks, chapters, format)}
                    </p>

                    {/* **Nothing names a unit itself** (addendum 16 §6c): a
                        collection's are Sections and a textbook's too, and
                        the label stands beside a figure that already reads
                        the noun table. */}
                    <label className="field">
                      Each {nouns.unit.toLowerCase()} arrives as
                      <select
                        aria-label={`Each ${nouns.unit.toLowerCase()} arrives as`}
                        value={split}
                        onChange={(event) => setSplit(event.target.value as PassageSplit)}
                      >
                        <option value="chapter">One {nouns.sub.toLowerCase()}, to divide by hand</option>
                        <option value="paragraph">A {nouns.sub.toLowerCase()} for every paragraph</option>
                      </select>
                    </label>
                    <p className="muted small">
                      {split === 'chapter'
                        ? `The ${nouns.unit.toLowerCase()} comes in whole. The ${nouns.unit} and ${nouns.sub} tools on the manuscript bar divide it where you want.`
                        : `Every paragraph is its own ${nouns.sub.toLowerCase()} on the timeline. Right for a short story; a long book arrives as hundreds of them.`}
                    </p>
                  </>
                ) : null}
                {/* The short-story format holds one story or many, and a
                    document cannot say which it is (addendum 22 §2): its
                    headings divide one story into sections, or begin a story
                    each. Asked here, where it is decided. */}
                {format === 'short_story' ? (
                  <fieldset className="import-stories">
                    <legend>What the {parts.length > 1 ? 'first document' : 'document'} is</legend>
                    <label>
                      <input type="radio" name="import-stories" aria-label="One story" checked={stories === 'one'} onChange={() => setStories('one')} />
                      One story — its headings divide it into sections, and the first names it.
                    </label>
                    <label>
                      <input type="radio" name="import-stories" aria-label="A collection" checked={stories === 'many'} onChange={() => setStories('many')} />
                      A collection — each chapter heading begins a story
                      {script ? ` (${script.scenes.filter((scene) => scene.heading.trim().length > 0).length} of them here)` : ''}. More can be added later from
                      File ▸ Add stories to the collection…
                    </label>
                  </fieldset>
                ) : null}
                {/* **Said before the press**, because the room that opens is
                    not the one an import has always landed in (addendum 33,
                    Ken: *in between, it will create the layout where you can
                    reorder how the stories are*). */}
                {landsInLayout(format) ? (
                  <p className="muted small">
                    The Layout room opens on them, where the order is dragged and the chapter pages are set.
                  </p>
                ) : null}
                {/* A book has no cast list to file and no sluglines to write
                    up, so the two choices are absent rather than greyed. */}
                {isProseFormat(format) ? null : (
                  <>
                    <label className="check">
                      <input
                        type="checkbox"
                        aria-label="File the cast"
                        checked={fileCast}
                        onChange={(event) => setFileCast(event.target.checked)}
                      />
                      <span>File the cast under main, recurring and minor by how much they speak</span>
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        aria-label="Keep the locations"
                        checked={keepLocations}
                        onChange={(event) => setKeepLocations(event.target.checked)}
                      />
                      <span>Write each location up under Research → Locations</span>
                    </label>
                  </>
                )}

                {/* Several files (addendum 22 §4a): the order they are listed
                    in is the order they go in, and on a format made of one
                    document the rest are said to be left out. */}
                {stage.kind === 'read' && parts.length > 1 ? (
                  <div className="import-more">
                    {partNoun ? (
                      <>
                        <h4>{parts.length} files, in order</h4>
                        <ol className="import-list import-order" aria-label="Files in order">
                          {parts.map((part, index) => {
                            const one = scriptOf(part, format, marks);
                            const counted = countOf(one);
                            const title = one.title || bareName(part.name);
                            return (
                              <li key={`${part.name}-${index}`}>
                                <span className="import-order-title">
                                  <span className="muted">{index + 1}.</span> {title}
                                </span>
                                <span className="muted">
                                  {counted.divisions} {counted.divisions === 1 ? nouns.unit.toLowerCase() : nouns.unitPlural.toLowerCase()} ·{' '}
                                  {counted.words.toLocaleString('en-US')} {counted.words === 1 ? 'word' : 'words'}
                                </span>
                                <span className="import-order-moves">
                                  <button type="button" className="ghost small" aria-label={`Move ${title} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="ghost small"
                                    aria-label={`Move ${title} down`}
                                    disabled={index === parts.length - 1}
                                    onClick={() => move(index, 1)}
                                  >
                                    ↓
                                  </button>
                                </span>
                                <button type="button" className="ghost small" aria-label={`Leave out ${title}`} onClick={() => drop(index)}>
                                  ×
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                        <p className="muted small">
                          The first makes the {wholeNoun}; each after it is the next {partNoun}, on a page of its own.
                        </p>
                      </>
                    ) : (
                      <p className="muted small" role="note">
                        {parts.length - 1 === 1 ? 'One more file was chosen and' : `${parts.length - 1} more files were chosen and`} will be left out: a{' '}
                        {nouns.work.toLowerCase()} is one document. Choose <em>Series or episodic</em> or <em>Short stories and collections</em> to
                        bring them in one after another.
                      </p>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}

            {stage.kind === 'read' && stage.failed.length > 0 ? (
              <>
                <h4>Not read</h4>
                <ul className="import-warnings">
                  {stage.failed.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <footer className="page-setup-actions">
            <button type="button" className="ghost" onClick={close}>
              Cancel
            </button>
            <button type="button" className="ghost" onClick={() => picker.current?.click()}>
              {script ? 'Choose others…' : 'Choose files…'}
            </button>
            <button type="button" className="primary" disabled={!script} onClick={finish}>
              Import
            </button>
          </footer>
        </>
      ) : null}
    </dialog>
  );
}

/** What the reader found, before anything is made from it. */
function Found({
  script,
  prose,
  divisions,
  divisionWord,
}: {
  script: ImportedScript;
  prose: boolean;
  divisions: number;
  /** What this format calls them, from the noun table: never the literal word. */
  divisionWord: string;
}) {
  const speeches = script.characters.reduce(
    (total: number, person: ImportedCharacter) => total + person.speeches,
    0,
  );

  const elements = script.scenes.flatMap((scene: ImportedScene) => scene.elements);
  const count = (type: string) => elements.filter((element) => element.type === type).length;

  return (
    <div className="import-found">
      <div className="report-figures">
        {/* A script's divisions are scenes whatever format it is going into;
            a book's are read off the noun table, so an instructional import
            counts Sections and a novel Chapters rather than one literal word
            for both (addendum 16 §6c). */}
        <Figure label={prose ? divisionWord : 'Scenes'} value={String(divisions)} />
        {prose ? (
          <>
            <Figure label="Paragraphs" value={String(count('paragraph') + count('blockquote'))} />
            <Figure label="Headings" value={String(count('heading'))} />
            <Figure label="Pictures" value={String(count('figure'))} />
          </>
        ) : (
          <>
            <Figure label="Characters" value={String(script.characters.length)} />
            <Figure label="Locations" value={String(script.locations.length)} />
            <Figure label="Speeches" value={String(speeches)} />
          </>
        )}
      </div>

      {script.title ? (
        <p className="muted small">
          {script.title}
          {script.author ? ` — ${script.author}` : ''}
        </p>
      ) : null}

      {/*
        **A book's divisions are not its locations.** `script.locations` is
        read off the headings, which in a screenplay are sluglines and in a
        manuscript are the chapters — so a novel drew *Where it happens* over
        CHAPTER ONE, CHAPTER THREE: THE ROAD, each with *1 scene* beside it:
        addendum 16 §6c's vocabulary fault on the one screen a writer uses to
        decide whether the reader found their chapters. What they want to see
        there is exactly that list, said as what it is and in the format's own
        noun, with how much is under each rather than a count of scenes a book
        does not have.
      */}
      {prose ? (
        <>
          <h4>The {divisionWord.toLowerCase()}</h4>
          <ul className="import-list">
            {script.scenes
              .filter((scene: ImportedScene) => scene.heading.trim().length > 0)
              .slice(0, 12)
              .map((scene: ImportedScene, index: number) => (
                <li key={`${scene.heading}-${index}`}>
                  <span>{scene.heading}</span>
                  <span className="muted">
                    {scene.elements.length} {scene.elements.length === 1 ? 'paragraph' : 'paragraphs'}
                  </span>
                </li>
              ))}
            {divisions > 12 ? <li className="muted">and {divisions - 12} more</li> : null}
          </ul>
        </>
      ) : null}

      {script.characters.length > 0 ? (
        <>
          <h4>Who is in it</h4>
          <ul className="import-list">
            {script.characters.slice(0, 12).map((person: ImportedCharacter) => (
              <li key={person.name}>
                <span>{person.name}</span>
                <span className="muted">
                  {/* Somebody the action names and never gives a line to is in
                      the cast on purpose (§18); "0 speeches" reads like the
                      reader failed to find their lines. */}
                  {person.speeches === 0
                    ? 'named in the action'
                    : `${person.speeches} ${person.speeches === 1 ? 'speech' : 'speeches'}`}{' '}
                  · {person.scenes} {person.scenes === 1 ? 'scene' : 'scenes'}
                </span>
              </li>
            ))}
            {script.characters.length > 12 ? (
              <li className="muted">and {script.characters.length - 12} more</li>
            ) : null}
          </ul>
        </>
      ) : null}

      {!prose && script.locations.length > 0 ? (
        <>
          <h4>Where it happens</h4>
          <ul className="import-list">
            {script.locations.slice(0, 8).map((place: ImportedLocation) => (
              <li key={place.name}>
                <span>{place.name}</span>
                <span className="muted">
                  {place.scenes} {place.scenes === 1 ? 'scene' : 'scenes'}
                  {place.where === 'unknown' ? '' : ` · ${place.where}`}
                </span>
              </li>
            ))}
            {script.locations.length > 8 ? <li className="muted">and {script.locations.length - 8} more</li> : null}
          </ul>
        </>
      ) : null}

      {script.warnings.length > 0 ? (
        <>
          <h4>Worth a look</h4>
          <ul className="import-warnings">
            {script.warnings.map((warning: string) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="report-figure">
      <span className="report-figure-value">{value}</span>
      <span className="report-figure-label">{label}</span>
    </div>
  );
}
