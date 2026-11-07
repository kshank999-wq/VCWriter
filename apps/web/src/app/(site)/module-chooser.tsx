import Link from 'next/link';
import { formatCardDetail, formatCardName, startableFormatCards } from '@vcwriter/domain';
import { moduleForFormat } from '@/lib/modules';

/**
 * The desktop's New project grid, on the site (addendum 35 §7).
 *
 * Only the module cards: no title, no author, no folder — a visitor is not
 * making a project, they are choosing which kind of writing to read about.
 * Each card is a link to that module's page. The cards are the domain's own
 * list, so this grid and the program's cannot drift; a game, built in VC Game
 * Studio, is not among them.
 */
export function ModuleChooser({ current }: { current?: string }) {
  return (
    <div className="module-options">
      {startableFormatCards().map((card) => {
        const page = moduleForFormat(card.value);
        if (!page) return null;
        return (
          <Link
            key={card.value}
            href={`/write/${page.slug}`}
            className="module-option"
            aria-current={current === page.slug ? 'page' : undefined}
          >
            <strong>{formatCardName(card)}</strong>
            <span>{formatCardDetail(card)}</span>
          </Link>
        );
      })}
    </div>
  );
}
