import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
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
 *
 * **Each module its own colour and mark** (from Ken, 26 November: *punch up
 * the what are you writing so everything doesn't look so monotone … make each
 * one a different color or something to catch attention*). The heading
 * over them stays plain gold (27 November: in its own rainbow it read as a
 * pride flag, which is not what the software is about); the boxes keep their
 * colours. A module not named here falls back to the house gold and a page.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const mark = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...stroke}>
    {children}
  </svg>
);

const LOOKS: Record<string, { colour: string; icon: ReactNode }> = {
  // A clapperboard.
  screenplay: {
    colour: '#ef6a4c',
    icon: mark(
      <>
        <rect x="3" y="9" width="18" height="11" rx="1.5" />
        <path d="M3 9l2.5-4.5 15 0L21 9M8 4.5L6.5 9M13 4.5L11.5 9M18 4.5L16.5 9" />
      </>,
    ),
  },
  // A screen.
  series: {
    colour: '#9b7bff',
    icon: mark(
      <>
        <rect x="3" y="6" width="18" height="12" rx="1.5" />
        <path d="M8 21h8M9 2.5l3 3.5 3-3.5" />
      </>,
    ),
  },
  // An open book.
  novel: {
    colour: '#4fb3e8',
    icon: mark(
      <>
        <path d="M12 6.5C9.5 5 6.5 4.6 3 5v13c3.5-.4 6.5 0 9 1.5 2.5-1.5 5.5-1.9 9-1.5V5c-3.5-.4-6.5 0-9 1.5z" />
        <path d="M12 6.5v13" />
      </>,
    ),
  },
  // A light bulb.
  instructional: {
    colour: '#52d08f',
    icon: mark(
      <>
        <path d="M9 17h6M10 20.5h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3z" />
      </>,
    ),
  },
  // Stage curtains.
  stage_play: {
    colour: '#f0568e',
    icon: mark(
      <>
        <path d="M3 3.5h18M4 3.5c0 6 1.5 10 5 12.5M20 3.5c0 6-1.5 10-5 12.5M4 3.5v17M20 3.5v17M7 20.5h10" />
      </>,
    ),
  },
  // A stack of pages.
  short_story: {
    colour: '#f5b544',
    icon: mark(
      <>
        <rect x="6" y="3" width="13" height="16" rx="1" />
        <path d="M4 6v14.5a1 1 0 0 0 1 1h11M9 8h7M9 11.5h7M9 15h4" />
      </>,
    ),
  },
  // A quill.
  short_form: {
    colour: '#35d0d0',
    icon: mark(
      <>
        <path d="M20 3.5C12 4.5 7 10 5.5 18.5M20 3.5c-1 6-4.5 10.5-11 12.5M5.5 18.5L4 21M9 12h5" />
      </>,
    ),
  },
  // A page with a folded corner.
  document: {
    colour: '#e2bd6a',
    icon: mark(
      <>
        <path d="M6 2.5h8l5 5v14H6z" />
        <path d="M14 2.5v5h5M9 12h7M9 15.5h7M9 19h4" />
      </>,
    ),
  },
};

const FALLBACK = LOOKS['document']!;

export function ModuleChooser({ current }: { current?: string }) {
  return (
    <div className="module-options">
      {startableFormatCards().map((card) => {
        const page = moduleForFormat(card.value);
        if (!page) return null;
        const look = LOOKS[card.value] ?? FALLBACK;
        return (
          <Link
            key={card.value}
            href={`/write/${page.slug}`}
            className="module-option"
            style={{ '--module': look.colour } as CSSProperties}
            aria-current={current === page.slug ? 'page' : undefined}
          >
            <i className="module-mark">{look.icon}</i>
            <strong>{formatCardName(card)}</strong>
            <span>{formatCardDetail(card)}</span>
            <b className="module-go" aria-hidden="true">
              See what it does →
            </b>
          </Link>
        );
      })}
    </div>
  );
}
