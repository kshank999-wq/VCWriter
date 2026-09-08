import type { ChapterPageContent, InlineSpan, Page } from '@vcwriter/domain';

/**
 * Paginated manuscript pages drawn as paper. Shared by the Preview page and
 * the viewport's Page view; the pages come from the domain's paginator, so
 * what is drawn here is exactly what prints.
 */
export function Paper({ pages, empty = 'Nothing written yet.' }: { pages: Page[]; empty?: string }) {
  return (
    <div className="pages">
      {pages.map((page) => (
        <section key={page.number} className={`paper${page.chapter ? ' chapter-leaf' : ''}`} aria-label={`Page ${page.number}`}>
          {page.number > 1 ? <span className="paper-number">{page.number}.</span> : null}
          {page.chapter ? (
            <ChapterLeaf chapter={page.chapter} />
          ) : (
            page.lines.map((line, index) => (
              <div
                // Lines have no identity of their own; they are a layout result.
                key={`${page.number}-${index}`}
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
