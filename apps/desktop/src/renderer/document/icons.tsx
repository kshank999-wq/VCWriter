import type { ReactNode } from 'react';

/**
 * **The ribbon's icons** (addendum 42 §3): drawn here as small line drawings
 * in the shapes Word users know — the clipboard, the brush, the A with a
 * colour bar under it — so the Home tab reads at a glance without anybody
 * having to learn new pictures. Stroked in the text colour; the two colour
 * tools carry a bar in the colour they will apply.
 */

const Svg = ({ size = 18, children }: { size?: number; children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const Chevron = () => (
  <svg width={8} height={8} viewBox="0 0 10 10" aria-hidden="true" className="wp-chevron">
    <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ICONS = {
  paste: (
    <Svg size={30}>
      <rect x="5" y="4" width="12" height="16" rx="1.5" />
      <path d="M9 4V3h4v1" />
      <rect x="10" y="9" width="10" height="12" rx="1.2" fill="var(--wp-icon-fill, #fff)" />
      <path d="M12.5 13h5M12.5 16h5M12.5 19h3" />
    </Svg>
  ),
  cut: (
    <Svg>
      <circle cx="6.5" cy="17.5" r="2.8" />
      <circle cx="17.5" cy="17.5" r="2.8" />
      <path d="M8.5 15.5 17 4M15.5 15.5 7 4" />
    </Svg>
  ),
  copy: (
    <Svg>
      <rect x="8" y="8" width="11" height="13" rx="1.5" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-8A1.5 1.5 0 0 0 5 5.5v10A1.5 1.5 0 0 0 6.5 17H8" />
    </Svg>
  ),
  painter: (
    <Svg>
      <rect x="4" y="3.5" width="13" height="5" rx="1.2" />
      <path d="M17 6h2.5v4.5H11V14" />
      <rect x="9.5" y="14" width="3" height="7" rx="1" />
    </Svg>
  ),
  grow: (
    <Svg>
      <path d="M3 20 8.5 6l5.5 14M5.2 15h6.6" />
      <path d="M16.5 9 19 6l2.5 3" />
    </Svg>
  ),
  shrink: (
    <Svg>
      <path d="M3 20 8.5 6l5.5 14M5.2 15h6.6" />
      <path d="M16.5 6 19 9l2.5-3" />
    </Svg>
  ),
  clear: (
    <Svg>
      <path d="M4 20 9.5 6 15 20M6.2 15h6.6" />
      <path d="m15.5 4 5 5-4 4h-3l-3-3z" fill="var(--wp-eraser, #f3b6c8)" />
    </Svg>
  ),
  bullets: (
    <Svg>
      <circle cx="5" cy="6.5" r="1.2" fill="currentColor" />
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="5" cy="17.5" r="1.2" fill="currentColor" />
      <path d="M9.5 6.5H20M9.5 12H20M9.5 17.5H20" />
    </Svg>
  ),
  numbering: (
    <Svg>
      <path d="M4 4.5h1.5V9M3.8 9h3.2" strokeWidth={1.3} />
      <path d="M3.8 14.2c.3-.8 1-1.2 1.7-1.2.9 0 1.5.6 1.5 1.3 0 1.4-3.2 2.2-3.2 4.2H7" strokeWidth={1.3} />
      <path d="M10 6.5h10M10 12h10M10 17.5h10" />
    </Svg>
  ),
  outdent: (
    <Svg>
      <path d="M11 6h9M11 10h9M11 14h9M4 18h16M7.5 8.5 4.5 11l3 2.5" />
    </Svg>
  ),
  indent: (
    <Svg>
      <path d="M11 6h9M11 10h9M11 14h9M4 18h16M4.5 8.5l3 2.5-3 2.5" />
    </Svg>
  ),
  sort: (
    <Svg>
      <path d="M4 10 6.5 4 9 10M4.8 8h3.4M4.5 14H9l-4.5 6H9" strokeWidth={1.4} />
      <path d="M16.5 4v15M13.5 16l3 3.5 3-3.5" />
    </Svg>
  ),
  pilcrow: (
    <Svg>
      <path d="M17 4v16M13 4v16M18.5 4H10a4 4 0 0 0 0 8h3" />
    </Svg>
  ),
  alignLeft: (
    <Svg>
      <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />
    </Svg>
  ),
  alignCenter: (
    <Svg>
      <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />
    </Svg>
  ),
  alignRight: (
    <Svg>
      <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />
    </Svg>
  ),
  justify: (
    <Svg>
      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </Svg>
  ),
  spacing: (
    <Svg>
      <path d="M11 6h9M11 10h9M11 14h9M11 18h9M5.5 4.5v15M3.5 7l2-2.5 2 2.5M3.5 17l2 2.5 2-2.5" />
    </Svg>
  ),
  find: (
    <Svg>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 5 5" />
    </Svg>
  ),
  replace: (
    <Svg>
      <path d="M4 8h11l-3-3M20 16H9l3 3" />
    </Svg>
  ),
  dictate: (
    <Svg size={30}>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="var(--wp-accent-soft, #dce6f4)" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
    </Svg>
  ),
};

/** The A with a bar under it in the colour it will apply. */
export const InkIcon = ({ colour }: { colour: string }) => (
  <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 17 12 3l6 14M8.4 12h7.2" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3" y="19" width="18" height="3.2" rx="0.6" fill={colour} />
  </svg>
);

/** The highlighter pen, with a bar in its colour. */
export const HighlightIcon = ({ colour }: { colour: string }) => (
  <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true">
    <path d="m8 13 6.5-9.5 4 3L12 16H8.5L7 17.5 5.5 16 8 13Z" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    <rect x="3" y="19" width="18" height="3.2" rx="0.6" fill={colour} />
  </svg>
);
