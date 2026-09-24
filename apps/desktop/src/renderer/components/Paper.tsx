import { Fragment } from 'react';
import {
  LAYOUT_OF_TEMPLATE,
  chapterLayout,
  chapterPageStyleSchema,
  chapterStyleVars,
  chapterStyleWith,
  isFullPageArt,
  runsText,
  type ChapterPageContent,
  type ChapterPageStyle,
  type ContentsPage,
  type IndexHeading,
  type IndexPage,
  type InlineSpan,
  type Page,
} from '@vcwriter/domain';
import { TitleSheet } from './TitleSheet';

/**
 * Paginated manuscript pages drawn as paper. Shared by the Preview page and
 * the viewport's Page view; the pages come from the domain's paginator, so
 * what is drawn here is exactly what prints.
 */
export function Paper({
  pages,
  chapterStyle,
  empty = 'Nothing written yet.',
}: {
  pages: Page[];
  /**
   * How the book sets its chapter pages (addendum 02 §12a). Given, the leaves
   * are drawn in it; left out, they are drawn as a book that has never been
   * styled — which is what the printed document does with the same absence.
   */
  chapterStyle?: ChapterPageStyle;
  empty?: string;
}) {
  return (
    <div className="pages">
      {pages.map((page, sheet) => (
        <section
          // A front page takes no number (§17), so several pages of the
          // document can be page 0; their place in the stack is the identity.
          key={sheet}
          className={
            `paper${page.chapter ? ' chapter-leaf' : ''}` +
            `${page.titlePage ? ' title-leaf' : ''}${page.contents ? ' contents-leaf' : ''}` +
            `${page.index ? ' index-leaf' : ''}`
          }
          aria-label={
            page.contents
              ? 'Contents'
              : page.index
                ? `Index, page ${page.number}`
                : page.titlePage
                ? `Title page: ${page.titlePage.episode || page.titlePage.title}`
                : `Page ${page.number}`
          }
        >
          {page.number > 1 ? <span className="paper-number">{page.number}.</span> : null}
          {page.contents ? (
            <ContentsLeaf contents={page.contents} />
          ) : page.index ? (
            <IndexLeaf index={page.index} />
          ) : page.titlePage ? (
            <TitleSheet page={page.titlePage} />
          ) : page.chapter ? (
            <ChapterLeaf chapter={page.chapter} style={chapterStyle} />
          ) : (
            page.lines.map((line, index) => (
              <div
                // Lines have no identity of their own; they are a layout result.
                key={`${sheet}-${index}`}
                className={`paper-line ${line.type}`}
                style={{ paddingLeft: `${line.indent}ch` }}
              >
                {line.spans.length > 0 ? line.spans.map((span, at) => <Emphasis key={at} span={span} />) : line.text.length > 0 ? line.text : ' '}
              </div>
            ))
          )}
        </section>
      ))}
      {pages.length === 0 ? <p className="muted empty">{empty}</p> : null}
    </div>
  );
}

/**
 * The contents page a document is bound with (addendum 02 §11, §17): the
 * work's name, then one line for each division.
 *
 * A book gives the page each chapter opens on, as a table of contents always
 * has. A series cannot — each episode numbers from its own page one — so its
 * lines carry how long each script runs and which sheet of the stack it
 * begins on, each under a heading, because a number that is not a page number
 * must not be read as one.
 */
function ContentsLeaf({ contents }: { contents: ContentsPage }) {
  const stack = contents.kind === 'episodes';
  return (
    <div className="contents-leaf-block">
      <h1 className="contents-series">{contents.title || 'Untitled'}</h1>
      <p className="contents-heading">Contents</p>
      <div className="contents-list">
        {stack ? (
          <div className="contents-row contents-head">
            <span className="contents-label" />
            <span className="contents-title" />
            <span className="contents-pages">Length</span>
            <span className="contents-sheet">Sheet</span>
          </div>
        ) : null}
        {contents.entries.map((entry) => (
          <Fragment key={entry.label}>
            <div className="contents-row">
              <span className="contents-label">{entry.label}</span>
              <span className="contents-title">{entry.title}</span>
              {stack ? (
                <span className="contents-pages">
                  {entry.pages} {entry.pages === 1 ? 'page' : 'pages'}
                </span>
              ) : null}
              <span className="contents-sheet">{stack ? entry.sheet : entry.page}</span>
            </div>
            {/* The sections under a chapter, indented (addendum 19 §6), with
                the number the page itself carries. */}
            {entry.sections.map((section) => (
              <div key={`${section.number}:${section.title}:${section.page}`} className="contents-row contents-section">
                <span className="contents-label">{section.number}</span>
                <span className="contents-title">{section.title}</span>
                <span className="contents-sheet">{section.page}</span>
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * A page of the back-of-book index (addendum 10), drawn the way the print
 * stylesheet draws it.
 *
 * **A run is one span and a principal discussion is bold**, which is the only
 * thing on the line telling *where this is discussed* from *where it is
 * mentioned*. A *see* stands where the numbers would be, because a redirect
 * has none; a *see also* follows them.
 */
function IndexEntry({ heading, level }: { heading: IndexHeading; level: 'term' | 'sub' }) {
  return (
    <div className={level === 'sub' ? 'index-entry index-sub' : 'index-entry'}>
      <span className="index-term">{heading.term}</span>
      <span className="index-pages">
        {heading.see.length > 0 ? (
          <em className="index-see">see {heading.see.join('; ')}</em>
        ) : (
          <>
            {heading.runs.map((run, at) => (
              <span key={`${run.from}-${run.to}`}>
                {at > 0 ? <span className="index-sep">, </span> : null}
                <span className={run.principal ? 'index-run principal' : 'index-run'}>
                  {runsText([run])}
                </span>
              </span>
            ))}
            {heading.seeAlso.length > 0 ? (
              <em className="index-see-also"> see also {heading.seeAlso.join('; ')}</em>
            ) : null}
          </>
        )}
      </span>
    </div>
  );
}

function IndexLeaf({ index }: { index: IndexPage }) {
  return (
    <div className="index-page">
      <p className="index-heading">{index.title}</p>
      <div className="index-list">
        {index.letters.map((group, at) => (
          <div key={group.letter + at}>
            <div className="index-letter">
              {group.letter}
              {index.continuing === group.letter && at === 0 ? (
                <span className="index-continued"> (continued)</span>
              ) : null}
            </div>
            {group.headings.map((heading) => (
              <div key={heading.term}>
                <IndexEntry heading={heading} level="term" />
                {heading.subEntries.map((sub) => (
                  <IndexEntry
                    key={sub.subTerm}
                    heading={{
                      term: sub.subTerm,
                      runs: sub.runs,
                      subEntries: [],
                      see: [],
                      seeAlso: sub.seeAlso,
                      orphans: 0,
                    }}
                    level="sub"
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The leaf a chapter opens with (addendum 02 §11), arranged by **the layout's
 * own slot list** (addendum 20 §14).
 *
 * It used to hold a private `template === 'graphic_top' ? … : …` ladder, which
 * knew three arrangements and could not draw a fourth — so a writer who set a
 * flush-left opening would have been shown a centred one. The order of the
 * pieces is read from `chapterLayout` now, which is the same list the print
 * walks, so the two cannot disagree about **where anything goes**.
 *
 * What it still does for itself is the **size**: this sheet stands for a page
 * at a few hundred pixels, and the printed rules are in points, so the
 * stylesheet scales them. That is a real difference between a thumbnail and a
 * page rather than a second opinion about the design — and where a preview has
 * room to be the page at its true size, it draws `renderChapterOpening` and
 * scales it instead, which is what the layout dialog does.
 */
export function ChapterLeaf({
  chapter,
  style,
  face,
}: {
  chapter: ChapterPageContent;
  style?: ChapterPageStyle;
  /**
   * The book's own body face, where the caller has one (addendum 20 §9g) —
   * what `book` as the face resolves to, exactly as the print resolves it. A
   * manuscript preview passes nothing and gets Courier, which is what a
   * script's leaf wants.
   */
  face?: string;
}) {
  const type = chapterStyleVars(
    chapterStyleWith(style ?? chapterPageStyleSchema.parse({}), chapter.placement),
    face,
  ) as React.CSSProperties;
  const layout = chapterLayout(chapter.layout ?? LAYOUT_OF_TEMPLATE[chapter.template]);
  const head = chapter.label.length > 0 || (!layout.hideTitle && chapter.title.length > 0);
  const piece = (slot: string): React.ReactNode => {
    switch (slot) {
      case 'number':
        // The number, the rule and the name are one block, as they are in the
        // print: it is what carries the book's optional rule under the whole
        // heading. The walk draws it where it meets the first of the three.
        return head ? (
          <div className="chapter-leaf-head" key="head">
            {chapter.label.length > 0 ? <p className="chapter-leaf-label">{chapter.label}</p> : null}
            {layout.rule && chapter.label.length > 0 ? <div className="chapter-leaf-slot-rule" /> : null}
            {!layout.hideTitle && chapter.title.length > 0 ? <p className="chapter-leaf-title">{chapter.title}</p> : null}
          </div>
        ) : null;
      case 'graphic':
        if (!chapter.image) return null;
        if (layout.graphic === 'bleed') {
          return (
            <div className="chapter-leaf-bleed" key="bleed">
              <img src={chapter.image.dataUrl} alt={chapter.image.name} />
            </div>
          );
        }
        return (
          <img
            className="chapter-leaf-device"
            key="device"
            src={chapter.image.dataUrl}
            alt={chapter.image.name}
            style={{ width: `${chapter.image.width}%` }}
          />
        );
      case 'epigraph':
        return chapter.epigraph.trim().length > 0 ? (
          <p className={layout.epigraphApart ? 'chapter-leaf-epigraph apart' : 'chapter-leaf-epigraph'} key="epigraph">
            {chapter.epigraph}
          </p>
        ) : null;
      case 'summary':
        return chapter.summary.trim().length > 0 ? (
          <p className="chapter-leaf-summary" key="summary">
            {chapter.summary}
          </p>
        ) : null;
      default:
        return null;
    }
  };
  // Full-page art (addendum 19 §7): the picture is the page and nothing is
  // set over it — the number and the name are drawn into the art.
  if ((isFullPageArt(chapter) || layout.graphic === 'page') && chapter.image) {
    return (
      <div className="chapter-leaf-block full_page" style={type}>
        <img className="chapter-leaf-art" src={chapter.image.dataUrl} alt={chapter.image.name} />
      </div>
    );
  }
  return (
    <div
      className={`chapter-leaf-block ${chapter.template} layout-${layout.id}`}
      style={{ textAlign: layout.align === 'left' ? 'left' : chapter.align, ...type }}
    >
      {layout.slots.map((slot) => piece(slot))}
    </div>
  );
}

/** A run of the line in the emphasis it was written with (spec §6). */
function Emphasis({ span }: { span: InlineSpan }) {
  let node: React.ReactNode = span.text;
  if (span.underline) node = <u>{node}</u>;
  if (span.italic) node = <i>{node}</i>;
  if (span.bold) node = <b>{node}</b>;
  return <>{node}</>;
}
