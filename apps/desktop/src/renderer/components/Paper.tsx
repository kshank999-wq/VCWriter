import type { Page } from '@vcwriter/domain';

/**
 * Paginated manuscript pages drawn as paper. Shared by the Preview page and
 * the viewport's Page view; the pages come from the domain's paginator, so
 * what is drawn here is exactly what prints.
 */
export function Paper({ pages, empty = 'Nothing written yet.' }: { pages: Page[]; empty?: string }) {
  return (
    <div className="pages">
      {pages.map((page) => (
        <section key={page.number} className="paper" aria-label={`Page ${page.number}`}>
          {page.number > 1 ? <span className="paper-number">{page.number}.</span> : null}
          {page.lines.map((line, index) => (
            <div
              // Lines have no identity of their own; they are a layout result.
              key={`${page.number}-${index}`}
              className={`paper-line ${line.type}`}
              style={{ paddingLeft: `${line.indent}ch` }}
            >
              {line.text.length > 0 ? line.text : ' '}
            </div>
          ))}
        </section>
      ))}
      {pages.length === 0 ? <p className="muted empty">{empty}</p> : null}
    </div>
  );
}
