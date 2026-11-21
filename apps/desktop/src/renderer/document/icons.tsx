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

/**
 * **The big pictures** for the other tabs (from Ken, 21 November: *more
 * stylish than the ones from Word, but with all the same functionality.
 * Icons, make the icons different*). Two-tone rather than Word's flat
 * colours: a line drawing in the text colour over a soft accent panel, so the
 * ribbon reads as one family and not as a copy.
 */
const Big = ({ children, size = 30 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="wp-duo">
    {children}
  </svg>
);
const Small = ({ children }: { children: ReactNode }) => <Big size={18}>{children}</Big>;
/** The soft panel behind a drawing. */
const Tint = (props: { x: number; y: number; w: number; h: number; r?: number }) => (
  <rect x={props.x} y={props.y} width={props.w} height={props.h} rx={props.r ?? 3} className="wp-tint" stroke="none" />
);
const Sheet = () => <path d="M9 4h10l6 6v17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M19 4v6h6" />;

export const BIG = {
  save: (
    <Big>
      <Tint x={7} y={6} w={18} h={9} />
      <path d="M6 6.5A1.5 1.5 0 0 1 7.5 5h14.4L26 9.1v15.4a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 6 24.5Z" />
      <path d="M10 5v7h11V5M10 26v-7h12v7" />
    </Big>
  ),
  saveAs: (
    <Big>
      <Tint x={7} y={6} w={14} h={8} />
      <path d="M17 26H7.5A1.5 1.5 0 0 1 6 24.5v-18A1.5 1.5 0 0 1 7.5 5h14.4L26 9.1V15" />
      <path d="M10 5v7h11V5M10 26v-7h6" />
      <path d="m21 27 1-4 6-6 3 3-6 6Z" />
    </Big>
  ),
  print: (
    <Big>
      <Tint x={5} y={12} w={22} h={10} />
      <path d="M10 12V5h12v7M10 22H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h20a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-4" />
      <path d="M10 18h12v9H10ZM13 22h6M13 24.5h4" />
      <circle cx="23" cy="15.5" r="0.8" fill="currentColor" />
    </Big>
  ),
  word: (
    <Big>
      <Tint x={8} y={10} w={17} h={17} />
      <Sheet />
      <path d="m11.5 15 1.6 7 2.4-5.5 2.4 5.5 1.6-7" />
    </Big>
  ),
  pdf: (
    <Big>
      <Tint x={8} y={10} w={17} h={17} />
      <Sheet />
      <path d="M11 22v-6h1.8a1.6 1.6 0 0 1 0 3.2H11M16 16v6h1.2a2.4 2.4 0 0 0 0-6ZM22 16h-2.2v6M19.8 19h1.8" strokeWidth={1.3} />
    </Big>
  ),
  text: (
    <Big>
      <Tint x={8} y={10} w={17} h={17} />
      <Sheet />
      <path d="M12 15h9M12 18.5h9M12 22h6" />
    </Big>
  ),
  insertFile: (
    <Big>
      <Tint x={8} y={10} w={17} h={17} />
      <Sheet />
      <path d="M16.5 14v9M13 19.5l3.5 3.5 3.5-3.5" />
    </Big>
  ),
  pageBreak: (
    <Big>
      <Tint x={8} y={4} w={16} h={9} />
      <path d="M8 4v9h16V4M8 28v-9h16v9" />
      <path d="M5 16h3M10.5 16h3M16 16h3M21.5 16h3" />
    </Big>
  ),
  table: (
    <Big>
      <Tint x={5} y={6} w={22} h={6} r={1} />
      <rect x="5" y="6" width="22" height="20" rx="2" />
      <path d="M5 12h22M5 19h22M12.5 6v20M19.5 6v20" />
    </Big>
  ),
  picture: (
    <Big>
      <Tint x={5} y={7} w={22} h={18} />
      <rect x="5" y="7" width="22" height="18" rx="2" />
      <circle cx="11.5" cy="12.5" r="2" />
      <path d="m5 22 6.5-6 4.5 4 4-3.5 7 6" />
    </Big>
  ),
  shapes: (
    <Big>
      <Tint x={15} y={14} w={12} h={12} r={2} />
      <circle cx="11" cy="11" r="6" />
      <rect x="15" y="14" width="12" height="12" rx="2" />
    </Big>
  ),
  headerFooter: (
    <Big>
      <Tint x={7} y={4} w={18} h={6} r={1} />
      <rect x="7" y="4" width="18" height="24" rx="1.5" />
      <path d="M7 10h18M7 22h18M11 14h10M11 17.5h7" />
    </Big>
  ),
  pageNumber: (
    <Big>
      <Tint x={7} y={4} w={18} h={24} />
      <rect x="7" y="4" width="18" height="24" rx="1.5" />
      <path d="M14 22.5h4M15 19l1-1v4.5" strokeWidth={1.4} />
      <path d="M11 9h10M11 12.5h10" />
    </Big>
  ),
  link: (
    <Big>
      <Tint x={6} y={12} w={11} h={8} r={4} />
      <path d="M14 18.5a4.5 4.5 0 0 0 6.4.4l3.7-3.7a4.5 4.5 0 0 0-6.4-6.4L16 10.5" />
      <path d="M18 13.5a4.5 4.5 0 0 0-6.4-.4l-3.7 3.7a4.5 4.5 0 0 0 6.4 6.4L16 21.5" />
    </Big>
  ),
  margins: (
    <Big>
      <Tint x={10} y={8} w={12} h={16} r={1} />
      <rect x="6" y="4" width="20" height="24" rx="1.5" />
      <path d="M10 4v24M22 4v24M6 8h20M6 24h20" strokeDasharray="1.5 2" />
    </Big>
  ),
  orientation: (
    <Big>
      <Tint x={12} y={15} w={16} h={11} r={1.5} />
      <rect x="5" y="4" width="11" height="15" rx="1.5" />
      <rect x="12" y="15" width="16" height="11" rx="1.5" />
      <path d="M20 6.5a5 5 0 0 1 4.5 4.5M23 9.5l1.5 1.5 1.5-1.5" />
    </Big>
  ),
  size: (
    <Big>
      <Tint x={9} y={7} w={15} h={19} />
      <rect x="9" y="7" width="15" height="19" rx="1.5" />
      <path d="M5 7v19M3.5 8.5 5 7l1.5 1.5M3.5 24.5 5 26l1.5-1.5M9 4h15M10.5 2.5 9 4l1.5 1.5M22.5 2.5 24 4l-1.5 1.5" strokeWidth={1.3} />
    </Big>
  ),
  breaks: (
    <Big>
      <Tint x={8} y={4} w={16} h={9} />
      <path d="M8 4v9h16V4M8 28v-9h16v9" />
      <path d="M4 16h24" strokeDasharray="2 2" />
    </Big>
  ),
  contents: (
    <Big>
      <Tint x={7} y={5} w={18} h={6} r={1.5} />
      <path d="M10 8h12M10 14.5h8M10 19h8M10 23.5h8" />
      <path d="M21 14.5h1M21 19h1M21 23.5h1" strokeWidth={2.2} />
      <rect x="6" y="4" width="20" height="24" rx="1.5" />
    </Big>
  ),
  footnote: (
    <Big>
      <Tint x={6} y={21} w={20} h={6} r={1.5} />
      <path d="M7 6h12M7 10h16M7 14h10" />
      <path d="M21 13.5v-4l-1.2 1" strokeWidth={1.3} />
      <path d="M6 20h9M8 24h14" />
    </Big>
  ),
  endnote: (
    <Big>
      <Tint x={6} y={18} w={20} h={10} r={1.5} />
      <path d="M7 5h18M7 9h18M7 13h12" />
      <path d="M8 21.5h3M13 21.5h12M8 25h3M13 25h9" />
    </Big>
  ),
  citation: (
    <Big>
      <Tint x={5} y={7} w={22} h={18} r={4} />
      <path d="M10 18c0-3 1-6 4-7M17 18c0-3 1-6 4-7" />
      <circle cx="11" cy="19.5" r="2.2" />
      <circle cx="18" cy="19.5" r="2.2" />
    </Big>
  ),
  bibliography: (
    <Big>
      <Tint x={7} y={6} w={7} h={21} r={1} />
      <rect x="7" y="6" width="7" height="21" rx="1" />
      <rect x="14" y="4" width="6" height="23" rx="1" />
      <path d="m21 7.5 4-1 4.5 19-4 1Z" />
    </Big>
  ),
  library: (
    <Big>
      <Tint x={5} y={5} w={22} h={22} r={4} />
      <path d="M9 25V9M13 25V7M17 25V9M21.5 25l2.5-16" />
      <path d="M6 25.5h20" />
    </Big>
  ),
  bringIn: (
    <Small>
      <path d="M6 16h16M17 11l5 5-5 5M26 6v20" />
    </Small>
  ),
  comment: (
    <Big>
      <Tint x={5} y={6} w={22} h={15} r={3} />
      <path d="M8 6h16a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-8l-6 5v-5H8a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z" />
      <path d="M16 10.5v6M13 13.5h6" />
    </Big>
  ),
  track: (
    <Big>
      <Tint x={5} y={5} w={18} h={22} />
      <path d="M8 9h12M8 13h9M8 17h6" />
      <path d="M7 23h7" strokeDasharray="0" />
      <path d="m18 26 1-4 7.5-7.5 3 3L22 25Z" />
      <rect x="5" y="5" width="18" height="22" rx="1.5" />
    </Big>
  ),
  accept: (
    <Big>
      <Tint x={6} y={6} w={20} h={20} r={10} />
      <path d="m10.5 16.5 3.5 3.5 7.5-8" strokeWidth={2} />
    </Big>
  ),
  reject: (
    <Big>
      <Tint x={6} y={6} w={20} h={20} r={10} />
      <path d="m11.5 11.5 9 9M20.5 11.5l-9 9" strokeWidth={2} />
    </Big>
  ),
  read: (
    <Big>
      <Tint x={4} y={12} w={8} h={8} r={1.5} />
      <path d="M4 13h5l6-5v16l-6-5H4Z" />
      <path d="M19 12a5 5 0 0 1 0 8M22.5 9a9.5 9.5 0 0 1 0 14" />
    </Big>
  ),
  spelling: (
    <Big>
      <Tint x={4} y={20} w={24} h={6} r={3} />
      <path d="M5 16 9 6l4 10M6.4 12.5h5.2M15 6h4a2.5 2.5 0 0 1 0 5h-4Zm0 5h4.5a2.5 2.5 0 0 1 0 5H15Z" strokeWidth={1.4} />
      <path d="m10 22.5 3.5 3 8-7.5" strokeWidth={2} />
    </Big>
  ),
  printLayout: (
    <Big>
      <Tint x={9} y={5} w={14} h={22} />
      <rect x="9" y="5" width="14" height="22" rx="1.5" />
      <path d="M12 10h8M12 13.5h8M12 17h8M12 20.5h5" />
    </Big>
  ),
  webLayout: (
    <Big>
      <Tint x={4} y={7} w={24} h={5} r={1} />
      <rect x="4" y="7" width="24" height="19" rx="2" />
      <path d="M4 12h24M8 16.5h16M8 20h16M8 23h10" />
      <circle cx="7" cy="9.5" r="0.7" fill="currentColor" />
    </Big>
  ),
  onePage: (
    <Small>
      <rect x="10" y="5" width="12" height="22" rx="1.5" />
      <path d="M13 10h6M13 14h6M13 18h4" />
    </Small>
  ),
  pageWidth: (
    <Small>
      <rect x="8" y="5" width="16" height="22" rx="1.5" />
      <path d="M3 16h26M6 13l-3 3 3 3M26 13l3 3-3 3" />
    </Small>
  ),
  zoom: (
    <Big>
      <Tint x={6} y={6} w={14} h={14} r={7} />
      <circle cx="13" cy="13" r="7.5" />
      <path d="m18.5 18.5 7.5 7.5M10 13h6M13 10v6" />
    </Big>
  ),
  previous: (
    <Small>
      <path d="M20 8 12 16l8 8" />
    </Small>
  ),
  next: (
    <Small>
      <path d="m12 8 8 8-8 8" />
    </Small>
  ),
  eye: (
    <Small>
      <path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16Z" />
      <circle cx="16" cy="16" r="3.5" />
    </Small>
  ),
  rule: (
    <Small>
      <path d="M4 16h24" />
      <path d="M8 11h16M8 21h16" strokeOpacity={0.4} />
    </Small>
  ),
  calendar: (
    <Small>
      <rect x="5" y="7" width="22" height="19" rx="2" />
      <path d="M5 13h22M11 4v6M21 4v6" />
    </Small>
  ),
  omega: (
    <Small>
      <path d="M8 25h5v-3a8 8 0 1 1 6 0v3h5" />
    </Small>
  ),
  unlink: (
    <Small>
      <path d="M14 18.5a4.5 4.5 0 0 0 6.4.4l3.7-3.7a4.5 4.5 0 0 0-6.4-6.4M18 13.5a4.5 4.5 0 0 0-6.4-.4l-3.7 3.7a4.5 4.5 0 0 0 6.4 6.4M5 5l22 22" />
    </Small>
  ),
};
