import { castRoleLine, type CastPageContent } from '@vcwriter/domain';

/**
 * A play's cast page, drawn (addendum 38 §4).
 *
 * The same page `renderCastSheet` prints, as markup for the dialog: the
 * heading, each role with its line, the doubling, the time and the place.
 * What is empty is not drawn, the title page's rule.
 */
export function CastSheet({ page }: { page: CastPageContent }) {
  return (
    <div className="cast-page-sheet">
      <h2 className="sheet-cast-heading">{page.heading}</h2>
      {page.roles.length === 0 ? (
        <p className="sheet-cast-empty">Nobody is listed yet.</p>
      ) : (
        <ul className="sheet-cast-roles">
          {page.roles.map((role) => {
            const line = castRoleLine(role);
            return (
              <li key={role.id}>
                {role.name}
                {line ? `, ${line}` : ''}
              </li>
            );
          })}
        </ul>
      )}
      {page.doubling.length > 0 ? (
        <div className="sheet-cast-block">
          <p>DOUBLING</p>
          {page.doubling.map((chain) => (
            <p key={chain.join('/')}>{chain.join(' / ')}</p>
          ))}
        </div>
      ) : null}
      {page.time ? <p className="sheet-cast-block">TIME: {page.time}</p> : null}
      {page.place ? <p className="sheet-cast-block">PLACE: {page.place}</p> : null}
      {page.notes ? <p className="sheet-cast-block sheet-cast-notes">{page.notes}</p> : null}
    </div>
  );
}
