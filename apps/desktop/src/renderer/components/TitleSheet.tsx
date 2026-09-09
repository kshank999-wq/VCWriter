import type { TitlePage } from '@vcwriter/domain';

/**
 * A title page, drawn (spec §6.1).
 *
 * Its own component because two screens draw the same page: the title page's
 * dialog, which shows what **Update page** would do before it is committed,
 * and the Preview, where an episode's front page is a page of the document
 * like any other (addendum 02 §17). One markup, so the two cannot drift and
 * neither can drift from what the print stylesheet emits.
 *
 * What is empty is not drawn. A first draft with a title and a name on it is
 * a proper title page, and an empty line printed for a contact nobody entered
 * is worse than no line. A logotype prints **in place of** the title: it is
 * the title, and setting it in Courier underneath would say it twice.
 */
export function TitleSheet({ page }: { page: TitlePage }) {
  // Contact left, date right, the draft's note centred under both — the way
  // the industry page sets its foot.
  const centred = [page.revision, page.notes].filter((part) => part.length > 0);
  const hasFoot = page.contact.length > 0 || page.draftDate.length > 0 || centred.length > 0;

  return (
    <div className="title-page-sheet">
      <div className="sheet-block">
        {page.titleImage ? <img className="sheet-art" src={page.titleImage} alt="" /> : <h1>{page.title || 'Untitled'}</h1>}
        {page.episode ? <p className="sheet-episode">{page.episode}</p> : null}
      </div>
      <div className="sheet-credit-block">
        {page.author ? (
          <>
            <p className="sheet-credit">Written</p>
            <p className="sheet-by">by</p>
            <p className="sheet-author">{page.author}</p>
          </>
        ) : null}
        {page.source ? <p className="sheet-source">{page.source}</p> : null}
        {page.sourceAuthor ? (
          <>
            <p className="sheet-by">by</p>
            <p className="sheet-author">{page.sourceAuthor}</p>
          </>
        ) : null}
      </div>
      {hasFoot ? (
        <div className="sheet-foot">
          <div className="sheet-foot-row">
            <p>{lines(page.contact)}</p>
            <p className="right">{lines(page.draftDate)}</p>
          </div>
          {centred.length > 0 ? <p className="sheet-note">{lines(centred.join('\n'))}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Several lines in one field are several lines on the page. */
const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => (
      <span key={`${index}-${line}`} className="sheet-line">
        {line}
      </span>
    ));
