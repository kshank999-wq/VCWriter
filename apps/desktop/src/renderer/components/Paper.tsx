import type { ChapterPageContent, ContentsPage, InlineSpan, Page } from '@vcwriter/domain';
import { TitleSheet } from './TitleSheet';

/**
 * Paginated manuscript pages drawn as paper. Shared by the Preview page and
 * the viewport's Page view; the pages come from the domain's paginator, so
 * what is drawn here is exactly what prints.
 */
export function Paper({ pages, empty = 'Nothing written yet.' }: { pages: Page[]; empty?: string }) {
  return (
    <div className="pages">
      {pages.map((page, sheet) => (
        <section
          // A front page takes no number (§17), so several pages of the
          // document can be page 0; their place in the stack is the identity.
          key={sheet}
          className={
            `paper${page.chapter ? ' chapter-leaf' : ''}` +
            `${page.titlePage ? ' title-leaf' : ''}${page.contents ? ' contents-leaf' : ''}`
          }
          aria-label={
            page.contents
              ? 'Contents'
              : page.titlePage
                ? `Title page: ${page.titlePage.episode || page.titlePage.title}`
                : `Page ${page.number}`
          }
        >
          {page.number > 1 ? <span className="paper-number">{page.number}.</span> : null}
          {page.contents ? (
            <ContentsLeaf contents={page.contents} />
          ) : page.titlePage ? (
            <TitleSheet page={page.titlePage} />
          ) : page.chapter ? (
            <ChapterLeaf chapter={page.chapter} />
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
          <div key={entry.label} className="contents-row">
            <span className="contents-label">{entry.label}</span>
            <span className="contents-title">{entry.title}</span>
            {stack ? (
              <span className="contents-pages">
                {entry.pages} {entry.pages === 1 ? 'page' : 'pages'}
              </span>
            ) : null}
            <span className="contents-sheet">{stack ? entry.sheet : entry.page}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The leaf a chapter opens with (addendum 02 §11), drawn the same way the
 * print stylesheet draws it: the block a third of the way down the page,
 * with whatever the writer left switched on.
 */
function ChapterLeaf({ chapter }: { chapter: ChapterPageContent }) {
  return (
    <div className="chapter-leaf-block" style={{ textAlign: chapter.align }}>
      {chapter.label.length > 0 ? <p className="chapter-leaf-label">{chapter.label}</p> : null}
      {chapter.title.length > 0 ? <p className="chapter-leaf-title">{chapter.title}</p> : null}
      {chapter.image ? (
        <img
          className="chapter-leaf-device"
          src={chapter.image.dataUrl}
          alt={chapter.image.name}
          style={{ width: `${chapter.image.width}%` }}
        />
      ) : null}
      {chapter.epigraph.trim().length > 0 ? <p className="chapter-leaf-epigraph">{chapter.epigraph}</p> : null}
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
