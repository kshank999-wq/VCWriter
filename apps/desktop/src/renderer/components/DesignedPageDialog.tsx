import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FACE_NAMES,
  FACE_NOTES,
  PART_FACES,
  PART_INFO,
  PART_TEMPLATES,
  PART_TEMPLATE_WORDS,
  TITLE_PAGE_OPTIONAL,
  TITLE_TEMPLATES,
  TITLE_TEMPLATE_WORDS,
  bookMetrics,
  bookNames,
  bookPageRows,
  bookSettingsOf,
  bookVars,
  chapterPageStyleSchema,
  halfOf,
  partChanges,
  partLogo,
  partModeOf,
  partStyleOf,
  partTemplateOf,
  partTemplatePatch,
  partsOf,
  proseStyleBase,
  publisherOf,
  renderBookPage,
  setTitlePage,
  titlePageContent,
  titlePageFieldsOf,
  titlePageOf,
  titlePageShown,
  titleTemplateOf,
  titleTemplatePatch,
  updatePart,
  type BookPart,
  type PartMode,
  type PartStyle,
  type PartTemplate,
  type ProjectFile,
  type TitlePageElement,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';

import type { Laying } from '../book-typeset';

/**
 * A designed page of the front matter, set on one screen (addendum 20 §9n,
 * from Ken's handoff).
 *
 * It replaces the part dialog's stack of fields for the four pages that are
 * **a block of words on a page of their own** — the half title, the title
 * page, a dedication, an epigraph — which `partPlacement` has called `block`
 * since §7a. Every other kind keeps the old fields, because the three
 * sections here are about placing a block and a page that flows has no block
 * to place.
 *
 * Three decisions carry it.
 *
 * **The mode is a reading.** What the page carries in place of its title —
 * the words, a logotype, a page of art — is `partModeOf`, read off the
 * record, so the tiles cannot disagree with what the page prints. Choosing a
 * tile is putting the picture in or taking it out, never setting a flag
 * beside one.
 *
 * **A template is a height, and the alignment is beside it.** The old five
 * conflated the two, so ranging a page left made it *Custom* though it sat
 * where *Classic* put it. Four heights, one alignment control, and the
 * template still read back rather than stored.
 *
 * **Cancel means cancel.** The room saves as you type and this dialog goes
 * on doing that, because a look is tuned against the sheet beside it (§12a)
 * — so the part as it stood when the screen opened is held, and Cancel puts
 * it back. Done keeps what is there, having already been kept.
 */

type Guides = boolean;

const MODES: ReadonlyArray<{ id: PartMode; label: string; hint: string }> = [
  { id: 'text', label: 'Title text', hint: 'Set in type from the book’s title' },
  { id: 'logo', label: 'Logotype', hint: 'An image in place of the title' },
  { id: 'art', label: 'Full-page art', hint: 'An image fills the whole page' },
];

const ALIGNS: ReadonlyArray<{ id: PartStyle['align']; label: string }> = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Centred' },
  { id: 'right', label: 'Right' },
];

const CASES: ReadonlyArray<{ id: PartStyle['title']['case']; label: string }> = [
  { id: 'as_typed', label: 'As typed' },
  { id: 'capitals', label: 'CAPITALS' },
  { id: 'small_caps', label: 'Small caps' },
];

/**
 * The title page's seven (§16), each saying **where its words come from** —
 * which is the section's whole argument: four are read from somewhere that
 * already held them, two more from the copyright page, and only the
 * contributor is typed here.
 */
const TITLE_ELEMENTS: ReadonlyArray<{
  id: TitlePageElement | 'title' | 'author';
  label: string;
  note: string;
  /** Where a writer changes it, when it is not here. */
  from?: 'book' | 'copyright';
}> = [
  { id: 'title', label: 'Book title', note: 'from Book settings', from: 'book' },
  { id: 'subtitle', label: 'Subtitle', note: 'directly below the title' },
  { id: 'author', label: 'Author’s name', note: 'from Book settings', from: 'book' },
  { id: 'contributor', label: 'Translator or editor', note: 'another contributor' },
  { id: 'edition', label: 'Edition', note: 'only if not the first', from: 'copyright' },
  { id: 'publisher', label: 'Publisher name or mark', note: 'at the foot of the page', from: 'copyright' },
  { id: 'location', label: 'Publisher location', note: 'city, state or country', from: 'copyright' },
];

export function DesignedPageDialog({
  file,
  part,
  laying,
  onUpdate,
  onClose,
  onPickLogo,
  onPickArt,
  onPickImprint,
  onOpenBookSettings,
  onOpenCopyright,
  onTurn,
}: {
  file: ProjectFile;
  part: BookPart | null;
  laying: Laying | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onClose(): void;
  /** Choose a logotype from a file; it joins the library like every picture. */
  onPickLogo(partId: string): void;
  /** Choose the page's art; the same picker, a different home on the part. */
  onPickArt(partId: string): void;
  /** The publisher's mark, on the title page: the same picker, a third home. */
  onPickImprint(partId: string): void;
  onOpenBookSettings(): void;
  /**
   * Open the copyright page's own screen. The publisher, its place and the
   * edition are typed there (§16), so this is a **route rather than a second
   * copy** — §15c's rule, which is what stops two pages naming two
   * publishers.
   */
  onOpenCopyright(): void;
  /** Turn to another page of the book, by its sheet. */
  onTurn(sheet: number): void;
}) {
  const dialog = useModal(part !== null);
  const [guides, setGuides] = useState<Guides>(false);
  /**
   * The part as it stood when the screen opened, so Cancel can put it back.
   * Held in a ref rather than in state: it is not something the screen
   * draws, and re-rendering on every keystroke would keep re-taking it.
   */
  const held = useRef<BookPart | null>(null);
  const openOn = part?.id ?? null;
  useEffect(() => {
    held.current = openOn ? (partsOf(file).find((one) => one.id === openOn) ?? null) : null;
    // Only when the screen opens on a different page: the point is the state
    // it was in **then**, which every later edit must not disturb.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOn]);

  return (
    <dialog ref={dialog} className="designed-page-dialog" aria-label={part ? PART_INFO[part.kind].name : 'Page'} onClose={onClose}>
      {part ? (
        <Body
          file={file}
          part={part}
          laying={laying}
          guides={guides}
          onGuides={setGuides}
          onUpdate={onUpdate}
          onPickLogo={onPickLogo}
          onPickArt={onPickArt}
          onPickImprint={onPickImprint}
          onOpenBookSettings={onOpenBookSettings}
          onOpenCopyright={onOpenCopyright}
          onTurn={onTurn}
          onCancel={() => {
            const was = held.current;
            if (was) onUpdate((current) => updatePart(current, was.id, was));
            onClose();
          }}
          onClose={onClose}
        />
      ) : null}
    </dialog>
  );
}

function Body({
  file,
  part,
  laying,
  guides,
  onGuides,
  onUpdate,
  onPickLogo,
  onPickArt,
  onPickImprint,
  onOpenBookSettings,
  onOpenCopyright,
  onTurn,
  onCancel,
  onClose,
}: {
  file: ProjectFile;
  part: BookPart;
  laying: Laying | null;
  guides: Guides;
  onGuides(on: Guides): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onPickLogo(partId: string): void;
  onPickArt(partId: string): void;
  onPickImprint(partId: string): void;
  onOpenBookSettings(): void;
  onOpenCopyright(): void;
  onTurn(sheet: number): void;
  onCancel(): void;
  onClose(): void;
}) {
  const settings = bookSettingsOf(file);
  const base = proseStyleBase(chapterPageStyleSchema.parse(file.settings.chapterPageStyle ?? {}), settings.size);
  const style = partStyleOf(part, base);
  const template = partTemplateOf(style);
  const titlePage = titlePageOf(file.project, file.settings);
  const mode = partModeOf(part, titlePage.titleImage);
  const changes = partChanges(part, base);
  const names = bookNames(file);
  const partId = part.id;
  /**
   * The title page's own half (§16). Every other designed page ignores it,
   * which is why it is a branch rather than a second dialog: the chrome, the
   * navigator, the guides, the footer and Cancel are the same screen's, and a
   * copy of them would be a second answer to all five.
   */
  const isTitle = part.kind === 'title_page';
  const plan = useMemo(() => partsOf(file), [file]);
  const fields = titlePageFieldsOf(part);
  const said = titlePageContent(file, part, plan);
  const house = publisherOf(file, plan);
  const arrangement = titleTemplateOf(style);

  /** Switch one of the five optional elements, keeping its words (§15's rule). */
  const show = (element: TitlePageElement, on: boolean) =>
    onUpdate((current) => {
      const now = partsOf(current).find((one) => one.id === partId) ?? part;
      const was = titlePageFieldsOf(now);
      return updatePart(current, partId, { titlePage: { ...was, shows: { ...was.shows, [element]: on } } });
    });

  const writeFields = (patch: Partial<ReturnType<typeof titlePageFieldsOf>>) =>
    onUpdate((current) => {
      const now = partsOf(current).find((one) => one.id === partId) ?? part;
      return updatePart(current, partId, { titlePage: { ...titlePageFieldsOf(now), ...patch } });
    });

  const write = (patch: Partial<PartStyle>) =>
    onUpdate((current) => {
      const now = partsOf(current).find((one) => one.id === partId) ?? part;
      return updatePart(current, partId, { style: { ...partStyleOf(now, base), ...patch } });
    });

  /**
   * Where this page falls in the book, for the navigator — a **reading** of
   * the laid pages rather than a number kept anywhere, so adding a page in
   * front of it moves it with nothing run.
   */
  const rows = useMemo(() => (laying ? bookPageRows(laying.laid.pages, laying.blocks) : []), [laying]);
  const at = rows.findIndex((row) => row.partId === partId);
  const here = at >= 0 ? rows[at] : undefined;
  const half = halfOf(part) === 'front' ? 'front matter' : 'back matter';

  /**
   * What goes on the page. A tile is **the act**, not a flag: choosing art
   * or a logotype opens the room's own picker, and choosing the words takes
   * the picture off — the mode is read back from what is there.
   */
  const pick = (want: PartMode) => {
    if (want === mode) return;
    if (want === 'art') {
      onPickArt(partId);
      return;
    }
    if (want === 'logo') {
      // A page of art stands in the way of a logotype, so it goes first.
      if (part.assetId) onUpdate((current) => updatePart(current, partId, { assetId: null }));
      onPickLogo(partId);
      return;
    }
    onUpdate((current) => updatePart(current, partId, { assetId: null, logoAssetId: null }));
  };

  const logo = partLogo(part, titlePage.titleImage);
  const showPlacement = mode !== 'art';
  /**
   * **A logotype replaces the title, not the page** (§16c, from Ken: *the new
   * title page box is not coming through*).
   *
   * On the half title a logotype *is* the whole content, so there is nothing
   * left to set and §9n hid the type with it. On the **title page** it stands
   * where the title would and the subtitle, the author, the contributor and
   * the whole publisher block go on printing — six of the seven — so hiding
   * them made the print draw things the screen would not let anybody reach.
   * Only a page of **art** really has nothing to set: it bleeds to the trim
   * and the words are in the picture.
   */
  const showType = isTitle ? mode !== 'art' : mode === 'text';
  /** The elements, for the same reason: they print under a logotype. */
  const showElements = isTitle && mode !== 'art';

  return (
    <>
      <header className="dp-head">
        <div className="dp-title">
          <strong>{PART_INFO[part.kind].name}</strong>
          <span className="muted small">
            {half} · {here ? `page ${here.counted}` : 'not laid yet'} · {here && here.sheet % 2 === 1 ? 'right-hand page' : 'left-hand page'}
          </span>
        </div>
        <div className="dp-nav">
          <button
            type="button"
            className="ghost"
            aria-label="The page before"
            disabled={!here || here.sheet <= 1}
            onClick={() => here && onTurn(here.sheet - 1)}
          >
            ‹
          </button>
          {/* The **sheet** rather than the printed number: the front matter
              counts in roman and the story in arabic, so *page i of 9* puts
              two numbering systems in one sentence. What it prints is on the
              chip beside the page and in the line under the name. */}
          <span className="muted small">
            {here ? `Page ${here.sheet} of ${rows.length}` : 'Page —'} · {half}
          </span>
          <button
            type="button"
            className="ghost"
            aria-label="The page after"
            disabled={!here || here.sheet >= rows.length}
            onClick={() => here && onTurn(here.sheet + 1)}
          >
            ›
          </button>
        </div>
        <button type="button" className="ghost dp-x" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="dp-body">
        <div className="dp-fields">
          <section className="dp-card">
            <h3>
              <span className="dp-num">1</span> {isTitle ? 'What’s on the page' : 'What goes on the page'}
              {/* Its own class: `dp-says` names **what is in force** — the
                  arrangement, the template — and a tally is not that. Two
                  things under one name is a second answer waiting to be
                  read. */}
              {showElements ? <span className="muted small dp-tally">{titlePageShown(part)} of 7 shown</span> : null}
            </h3>
            <div className="dp-tiles">
              {MODES.map((one) => (
                <button
                  key={one.id}
                  type="button"
                  className={mode === one.id ? 'dp-tile on' : 'dp-tile'}
                  aria-pressed={mode === one.id}
                  onClick={() => pick(one.id)}
                >
                  <strong>{one.label}</strong>
                  <span className="muted small">{one.hint}</span>
                </button>
              ))}
            </div>
            {showElements ? (
              /* The seven elements (§16). Each row says where its words come
                 from, because six of the seven are read from somewhere that
                 already held them — a box here for any of those would be a
                 second answer to what the book is called, who published it or
                 which edition this is. */
              <ul className="dp-elements">
                {TITLE_ELEMENTS.map((one) => {
                  const required = one.id === 'title' || one.id === 'author';
                  const on = required || fields.shows[one.id as TitlePageElement];
                  const words =
                    one.id === 'title'
                      ? said.title
                      : one.id === 'author'
                        ? said.author
                        : one.id === 'subtitle'
                          ? titlePage.episode
                          : one.id === 'contributor'
                            ? fields.contributor
                            : one.id === 'edition'
                              ? house.edition
                              : one.id === 'publisher'
                                ? house.name
                                : house.place;
                  return (
                    <li key={one.id} className={on ? 'dp-element' : 'dp-element off'}>
                      <div className="dp-element-head">
                        {required ? (
                          <span className="dp-required">REQUIRED</span>
                        ) : (
                          <button
                            type="button"
                            className="dp-switch"
                            role="switch"
                            aria-checked={on}
                            aria-label={`Show the ${one.label.toLowerCase()}`}
                            onClick={() => show(one.id as TitlePageElement, !on)}
                          >
                            <span className={on ? 'dp-switch-track on' : 'dp-switch-track'} aria-hidden="true">
                              <span />
                            </span>
                          </button>
                        )}
                        <strong>{one.label}</strong>
                        <span className="muted small">{one.note}</span>
                      </div>
                      {on ? (
                        one.id === 'title' && mode === 'logo' ? (
                          /* A logotype stands where the title would (§16c), so
                             the row says what will print rather than showing
                             words the page does not set. */
                          <div className="dp-element-pair">
                            <p className="dp-reads">A logotype stands here. The words are not set.</p>
                            <button type="button" className="ghost small" onClick={() => onPickLogo(partId)}>
                              Another logotype…
                            </button>
                            <button
                              type="button"
                              className="ghost small"
                              onClick={() => onUpdate((current) => updatePart(current, partId, { logoAssetId: null }))}
                            >
                              Set the title instead
                            </button>
                          </div>
                        ) : one.id === 'contributor' ? (
                          <div className="dp-element-pair">
                            <div className="dp-seg" role="group" aria-label="Which contributor">
                              {(['translator', 'editor'] as const).map((role) => (
                                <button
                                  key={role}
                                  type="button"
                                  className={fields.contributorRole === role ? 'on' : ''}
                                  aria-pressed={fields.contributorRole === role}
                                  onClick={() => writeFields({ contributorRole: role })}
                                >
                                  {role === 'translator' ? 'Translator' : 'Editor'}
                                </button>
                              ))}
                            </div>
                            <input
                              aria-label="Translator or editor"
                              placeholder="Name"
                              value={fields.contributor}
                              onChange={(event) => writeFields({ contributor: event.target.value })}
                            />
                          </div>
                        ) : one.id === 'subtitle' ? (
                          <input
                            aria-label="Subtitle"
                            placeholder="A subtitle — A novel, Stories — or nothing"
                            value={titlePage.episode}
                            onChange={(event) => onUpdate((current) => setTitlePage(current, { episode: event.target.value }))}
                          />
                        ) : one.id === 'publisher' ? (
                          <div className="dp-element-pair">
                            <p className="dp-reads">{fields.imprintAssetId ? 'A mark stands in place of the name.' : words || 'Not named yet'}</p>
                            <button type="button" className="ghost small" onClick={() => onPickImprint(partId)}>
                              {fields.imprintAssetId ? 'Another mark…' : 'Use a mark…'}
                            </button>
                            {fields.imprintAssetId ? (
                              <button type="button" className="ghost small" onClick={() => writeFields({ imprintAssetId: null })}>
                                Set the name instead
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <div className="dp-element-pair">
                            <p className="dp-reads">{words || 'Not given yet'}</p>
                            {/* A route rather than a second box (§15c): the
                                publisher and the edition are typed on the
                                copyright page, and a book naming two
                                publishers is a mistake, not a design. */}
                            <button
                              type="button"
                              className="ghost small"
                              onClick={() => (one.from === 'copyright' ? onOpenCopyright() : onOpenBookSettings())}
                            >
                              {one.from === 'copyright' ? 'Edit on the copyright page' : 'Edit in Book settings'}
                            </button>
                          </div>
                        )
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : mode === 'text' ? (
              <div className="dp-slot">
                <div>
                  <span className="dp-label">Title from the book</span>
                  <p className="dp-serif">{titlePage.title || names.title}</p>
                </div>
                {/* The title is read-only here because it is the **book's**
                    (§3a): one reading names the book and everything that
                    prints it asks that, so a second box would be a second
                    answer. */}
                <button type="button" className="raised small" onClick={onOpenBookSettings}>
                  Edit in Book settings
                </button>
              </div>
            ) : (
              <div className="dp-slot dp-slot-empty">
                {/* **Absent with the reason said** (§16c). A page of art is
                    the one mode where none of the seven print, and a screen
                    that simply drops them leaves a writer looking for a
                    panel they were told they had. */}
                <p className="muted small">
                  {mode === 'logo'
                    ? logo
                      ? 'A logotype stands in place of the title. The words are not set.'
                      : 'No logotype yet.'
                    : isTitle
                      ? 'The picture is the page, edge to edge. None of the seven elements print — the title, the author and the publisher are all in the artwork — so there is nothing here to set. Choose Title text or Logotype to set them.'
                      : 'The picture is the page, edge to edge. Nothing is set over it.'}
                </p>
                <button type="button" className="raised small" onClick={() => (mode === 'logo' ? onPickLogo(partId) : onPickArt(partId))}>
                  {mode === 'logo' ? (logo ? 'Another logotype…' : 'Choose a logotype…') : part.assetId ? 'Another picture…' : 'Choose a picture…'}
                </button>
              </div>
            )}
          </section>

          {/* Absent rather than greyed on a page of art (§9n): the art bleeds
              to the trim, so there is no block to place and no type to set. */}
          {showPlacement ? (
            <section className="dp-card">
              <h3>
                <span className="dp-num">2</span> Placement
                <span className="muted small dp-says">
                  {isTitle
                    ? arrangement
                      ? TITLE_TEMPLATE_WORDS[arrangement].name
                      : 'Custom · placed by hand'
                    : template
                      ? PART_TEMPLATE_WORDS[template].name
                      : 'Custom · placed by hand'}
                </span>
              </h3>
              {/* The title page's arrangements are a **pair** of heights
                  (§16): a title at a third of the way down says nothing about
                  whether the author is under it or half a page below, so one
                  height cannot name the arrangement. */}
              {isTitle ? (
                <div className="dp-templates">
                  {TITLE_TEMPLATES.map((one) => (
                    <button
                      key={one}
                      type="button"
                      className={arrangement === one ? 'dp-template on' : 'dp-template'}
                      aria-pressed={arrangement === one}
                      title={TITLE_TEMPLATE_WORDS[one].says}
                      onClick={() => write(titleTemplatePatch(one))}
                    >
                      <span className="dp-sheet" aria-hidden="true">
                        <span style={{ top: `${TITLE_TEMPLATE_WORDS[one].drop}%` }} />
                        <span
                          className="dp-sheet-author"
                          style={{ top: `${TITLE_TEMPLATE_WORDS[one].authorDrop ?? TITLE_TEMPLATE_WORDS[one].drop + 12}%` }}
                        />
                      </span>
                      {TITLE_TEMPLATE_WORDS[one].name}
                    </button>
                  ))}
                </div>
              ) : (
              <div className="dp-templates">
                {PART_TEMPLATES.map((one) => (
                  <button
                    key={one}
                    type="button"
                    className={template === one ? 'dp-template on' : 'dp-template'}
                    aria-pressed={template === one}
                    title={PART_TEMPLATE_WORDS[one].says}
                    onClick={() => write(partTemplatePatch(one))}
                  >
                    <span className="dp-sheet" aria-hidden="true">
                      <span style={{ top: `${PART_TEMPLATE_WORDS[one].drop}%` }} />
                    </span>
                    {PART_TEMPLATE_WORDS[one].name}
                  </button>
                ))}
              </div>
              )}
              <label className="field dp-slider">
                <span>
                  {isTitle ? 'Title height' : 'Height on the page'} <strong>{style.drop}% down</strong>
                </span>
                <input
                  type="range"
                  min={10}
                  max={80}
                  step={1}
                  aria-label="Height on the page"
                  value={style.drop}
                  onChange={(event) => write({ drop: Number(event.target.value) })}
                />
              </label>
              <div className="dp-marks" aria-hidden="true">
                <span>Top</span>
                <span>Middle</span>
                <span>Bottom</span>
              </div>
              {/* **One field, both answers** (§16): a height means the author
                  stands there, and nothing means directly under the title, so
                  there is no mode flag beside the number that could disagree
                  with it. */}
              {isTitle ? (
                <>
                  <div className="dp-row">
                    <span className="dp-row-label">Author</span>
                    <div className="dp-seg" role="group" aria-label="Where the author stands">
                      <button
                        type="button"
                        className={style.authorDrop !== null ? 'on' : ''}
                        aria-pressed={style.authorDrop !== null}
                        onClick={() => write({ authorDrop: style.authorDrop ?? 52 })}
                      >
                        Placed separately
                      </button>
                      <button
                        type="button"
                        className={style.authorDrop === null ? 'on' : ''}
                        aria-pressed={style.authorDrop === null}
                        onClick={() => write({ authorDrop: null })}
                      >
                        Right under the title
                      </button>
                    </div>
                  </div>
                  {/* Absent rather than greyed where the author has no height
                      of its own: there is nothing for the slider to move. */}
                  {style.authorDrop !== null ? (
                    <label className="field dp-slider">
                      <span>
                        Author height <strong>{style.authorDrop}% down</strong>
                      </span>
                      <input
                        type="range"
                        min={10}
                        max={85}
                        step={1}
                        aria-label="Author height"
                        value={style.authorDrop}
                        onChange={(event) => write({ authorDrop: Number(event.target.value) })}
                      />
                    </label>
                  ) : null}
                </>
              ) : null}
              <div className="dp-row">
                <span className="dp-row-label">Alignment</span>
                <div className="dp-seg" role="group" aria-label="Alignment">
                  {ALIGNS.map((one) => (
                    <button
                      key={one.id}
                      type="button"
                      className={style.align === one.id ? 'on' : ''}
                      aria-pressed={style.align === one.id}
                      onClick={() => write({ align: one.id })}
                    >
                      {one.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {showType ? (
            <section className="dp-card">
              <h3>
                <span className="dp-num">3</span> Typography
              </h3>
              <div className="dp-pair">
                <label className="field">
                  <span>Typeface</span>
                  <select aria-label="Typeface" value={style.face} onChange={(event) => write({ face: event.target.value as PartStyle['face'] })}>
                    {PART_FACES.map((one) => (
                      <option key={one} value={one}>
                        {one === 'book' ? 'The book’s own face' : `${FACE_NAMES[one]} — ${FACE_NOTES[one]}`}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field">
                  <span>Size</span>
                  <div className="dp-step">
                    <button
                      type="button"
                      className="raised small"
                      aria-label="Smaller"
                      onClick={() => write({ title: { ...style.title, size: Math.max(10, style.title.size - 1) } })}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      aria-label="Size in points"
                      min={10}
                      max={72}
                      value={style.title.size}
                      onChange={(event) =>
                        write({ title: { ...style.title, size: Math.min(72, Math.max(10, Number(event.target.value) || style.title.size)) } })
                      }
                    />
                    <button
                      type="button"
                      className="raised small"
                      aria-label="Larger"
                      onClick={() => write({ title: { ...style.title, size: Math.min(72, style.title.size + 1) } })}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              {/* The **author's** own size (§16). It was `line`, shared with
                  the subtitle and the publisher, so setting the author set
                  all three — §7a's running heads on the page in front of
                  them. The subtitle's size is the title's and there is
                  nowhere to type one. */}
              {isTitle ? (
                <div className="dp-pair">
                  <div className="field">
                    <span>Author size</span>
                    <div className="dp-step">
                      <button
                        type="button"
                        className="raised small"
                        aria-label="Smaller author"
                        onClick={() => write({ line: { ...style.line, size: Math.max(8, style.line.size - 1) } })}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        aria-label="Author size in points"
                        min={8}
                        max={36}
                        value={style.line.size}
                        onChange={(event) =>
                          write({ line: { ...style.line, size: Math.min(36, Math.max(8, Number(event.target.value) || style.line.size)) } })
                        }
                      />
                      <button
                        type="button"
                        className="raised small"
                        aria-label="Larger author"
                        onClick={() => write({ line: { ...style.line, size: Math.min(36, style.line.size + 1) } })}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="dp-row">
                <span className="dp-row-label">{isTitle ? 'Title case' : 'Case'}</span>
                <div className="dp-seg" role="group" aria-label={isTitle ? 'Title case' : 'Case'}>
                  {CASES.map((one) => (
                    <button
                      key={one.id}
                      type="button"
                      className={style.title.case === one.id ? 'on' : ''}
                      aria-pressed={style.title.case === one.id}
                      onClick={() => write({ title: { ...style.title, case: one.id } })}
                    >
                      {one.label}
                    </button>
                  ))}
                </div>
              </div>
              {isTitle ? (
                <div className="dp-row">
                  <span className="dp-row-label">Author case</span>
                  <div className="dp-seg" role="group" aria-label="Author case">
                    {CASES.map((one) => (
                      <button
                        key={one.id}
                        type="button"
                        className={style.line.case === one.id ? 'on' : ''}
                        aria-pressed={style.line.case === one.id}
                        onClick={() => write({ line: { ...style.line, case: one.id } })}
                      >
                        {one.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="dp-row">
                <span className="dp-row-label">Style</span>
                <button
                  type="button"
                  className={style.title.bold ? 'dp-mark on' : 'dp-mark'}
                  aria-label="Bold"
                  aria-pressed={style.title.bold}
                  onClick={() => write({ title: { ...style.title, bold: !style.title.bold } })}
                >
                  B
                </button>
                <button
                  type="button"
                  className={style.title.italic ? 'dp-mark dp-italic on' : 'dp-mark dp-italic'}
                  aria-label="Italic"
                  aria-pressed={style.title.italic}
                  onClick={() => write({ title: { ...style.title, italic: !style.title.italic } })}
                >
                  I
                </button>
              </div>
              <label className="field dp-slider">
                <span>
                  Letter spacing <strong>{(style.title.tracking / 100).toFixed(2)} em</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  aria-label="Letter spacing"
                  value={style.title.tracking}
                  onChange={(event) => write({ title: { ...style.title, tracking: Number(event.target.value) } })}
                />
              </label>
              {isTitle ? (
                <button
                  type="button"
                  className="dp-switch"
                  role="switch"
                  aria-checked={style.subtitleItalic}
                  aria-label="Italic subtitle"
                  onClick={() => write({ subtitleItalic: !style.subtitleItalic })}
                >
                  <span className={style.subtitleItalic ? 'dp-switch-track on' : 'dp-switch-track'} aria-hidden="true">
                    <span />
                  </span>
                  Italic subtitle
                </button>
              ) : null}
              <button
                type="button"
                className="dp-switch"
                role="switch"
                aria-checked={style.rule}
                aria-label="Rule under the title"
                onClick={() => write({ rule: !style.rule })}
              >
                <span className={style.rule ? 'dp-switch-track on' : 'dp-switch-track'} aria-hidden="true">
                  <span />
                </span>
                Rule under the title
              </button>
            </section>
          ) : null}

          {/* Said rather than hidden (§16): these are not settings, and a
              writer who cannot find a control for them should be told why
              rather than left hunting. The renderer enforces them — the
              recto, the folio and the verso are the plan's, not this
              screen's. */}
          {isTitle ? (
            <p className="dp-locked muted small">
              Set by publishing convention: always a right-hand page, counted in the page total but printed with no page number or
              running head. The copyright page goes on its back.
            </p>
          ) : null}
        </div>

        <div className="dp-preview">
          <div className="dp-preview-head">
            <span className="dp-label">Preview</span>
            <span className="dp-chip">{here && here.folio ? `Page ${here.folio}` : 'Unnumbered'}</span>
            <span className="dp-chip">{here && here.sheet % 2 === 1 ? 'Recto' : 'Verso'}</span>
            <button
              type="button"
              className={guides ? 'dp-chip dp-chip-on' : 'dp-chip'}
              aria-pressed={guides}
              onClick={() => onGuides(!guides)}
            >
              Guides
            </button>
          </div>
          <Sheet laying={laying} partId={partId} guides={guides} drop={style.drop} />
        </div>
      </div>

      <footer className="dp-foot">
        {/* What the page owes the style it would otherwise take. It counts
            the **resolved** settings rather than the keys in the record, so a
            field set back to its default by hand is not a change. */}
        {/* A missing publisher is **said, never refused** (§16): plenty of
            books are published by nobody in particular, so it is a note about
            what most title pages carry rather than something to fix. */}
        {isTitle && said.publisher.trim().length === 0 && fields.imprintAssetId === null ? (
          <span className="dp-status dp-status-warn">
            No publisher name or mark — fine for self-publishing, but most title pages carry one
          </span>
        ) : (
          <span className={changes > 0 ? 'dp-status dp-status-off' : 'dp-status dp-status-on'}>
            {changes > 0
              ? `${changes} change${changes === 1 ? '' : 's'} from the ${half === 'front matter' ? 'front-matter' : 'back-matter'} style`
              : `Matches the ${half === 'front matter' ? 'front-matter' : 'back-matter'} style`}
          </span>
        )}
        <span className="dp-spacer" />
        <button type="button" className="ghost" onClick={() => onUpdate((current) => updatePart(current, partId, { style: {} }))}>
          Reset to page style
        </button>
        <button type="button" className="raised" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="raised dp-done" onClick={onClose}>
          Done
        </button>
      </footer>
    </>
  );
}

/**
 * The page itself, drawn by the **same renderer the book prints with**, so
 * what is on the screen is what is on the paper — the room's rule since the
 * spread was first drawn.
 *
 * The guides are the room's own and nothing about them is stored: the text
 * block from the geometry, and a line at the chosen height, which is the one
 * thing a writer cannot otherwise see themselves setting.
 */
function Sheet({ laying, partId, guides, drop }: { laying: Laying | null; partId: string; guides: boolean; drop: number }) {
  const blocks = useMemo(() => new Map((laying?.blocks ?? []).map((block) => [block.id, block])), [laying]);
  const page = (laying?.laid.pages ?? []).find((one) =>
    one.pieces.some((piece) => {
      const block = blocks.get(piece.blockId);
      return block !== undefined && (block.id === partId || block.partId === partId);
    }),
  );
  if (!laying || !page) return <div className="dp-sheet-box muted small">Setting the page…</div>;
  const { pageWidthPx, pageHeightPx } = bookMetrics(laying.geometry);
  const scale = Math.min(1, 570 / pageHeightPx, 420 / pageWidthPx);
  const vars = {
    ...bookVars(laying.context),
    '--bk-page-width': `${pageWidthPx}px`,
    '--bk-page-height': `${pageHeightPx}px`,
  } as React.CSSProperties;
  return (
    <div className="dp-sheet-box" style={{ width: pageWidthPx * scale, height: pageHeightPx * scale }}>
      <div className="layout-spread" style={{ ...vars, transform: `scale(${scale})` }}>
        {/* The page's own markup, every string in it escaped by the builder. */}
        <div className="layout-sheet" dangerouslySetInnerHTML={{ __html: renderBookPage(page, blocks, laying.context) }} />
        {guides ? (
          <div className="dp-guides" aria-hidden="true">
            <span
              className="dp-guide-block"
              style={{
                top: `${laying.geometry.margins.top}in`,
                bottom: `${laying.geometry.margins.bottom}in`,
                left: `${page.side === 'recto' ? laying.geometry.margins.inside : laying.geometry.margins.outside}in`,
                right: `${page.side === 'recto' ? laying.geometry.margins.outside : laying.geometry.margins.inside}in`,
              }}
            />
            <span className="dp-guide-line" style={{ top: `${drop}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
