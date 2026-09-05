/**
 * The VC Writer wordmark for the site header (docs/brand.md). Inline SVG:
 * scales, ships no asset, and needs no exception in the content security
 * policy. A sibling of the VC Film Studio mark, not a copy.
 */
export function Wordmark() {
  return (
    <svg viewBox="0 0 220 28" width="228" height="29" role="img" aria-label="VC Writer">
      <defs>
        <linearGradient id="vcw-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8c872" />
          <stop offset="1" stopColor="#a8873e" />
        </linearGradient>
      </defs>
      <line x1="0" y1="14" x2="26" y2="14" stroke="url(#vcw-gold)" strokeWidth="1" />
      <line x1="194" y1="14" x2="220" y2="14" stroke="url(#vcw-gold)" strokeWidth="1" />
      <path d="M110 2 L114 6 L110 10 L106 6 Z" fill="#8b1c1c" stroke="url(#vcw-gold)" strokeWidth="0.75" />
      <text
        x="110"
        y="23"
        textAnchor="middle"
        fontFamily="Futura, 'Avenir Next', 'Century Gothic', 'Segoe UI', system-ui, sans-serif"
        fontSize="14"
        fontWeight="600"
        letterSpacing="4"
        fill="url(#vcw-gold)"
      >
        VC WRITER
      </text>
    </svg>
  );
}

/**
 * The framed mark, for the landing page: a stepped gold frame, a sunburst,
 * the letters, and the deco diamond. The poster version of the header mark.
 */
export function Emblem() {
  const rays = Array.from({ length: 11 }, (_, index) => -75 + index * 15);
  return (
    <svg className="emblem" viewBox="0 0 360 200" role="img" aria-label="VC Writer">
      <defs>
        <linearGradient id="vcw-emblem-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efd48a" />
          <stop offset="0.5" stopColor="#c9a45c" />
          <stop offset="1" stopColor="#8a6f2f" />
        </linearGradient>
        <radialGradient id="vcw-emblem-burst" cx="0.5" cy="0.2" r="0.7">
          <stop offset="0" stopColor="#c9a45c" stopOpacity="0.28" />
          <stop offset="1" stopColor="#c9a45c" stopOpacity="0" />
        </radialGradient>
        <clipPath id="vcw-emblem-frame">
          <path d="M18 30 H30 V18 H330 V30 H342 V170 H330 V182 H30 V170 H18 Z" />
        </clipPath>
      </defs>
      <rect width="360" height="200" fill="url(#vcw-emblem-burst)" />
      <path d="M10 24 H24 V10 H336 V24 H350 V176 H336 V190 H24 V176 H10 Z" fill="none" stroke="#8a6f2f" strokeWidth="1" />
      <path d="M18 30 H30 V18 H330 V30 H342 V170 H330 V182 H30 V170 H18 Z" fill="none" stroke="url(#vcw-emblem-gold)" strokeWidth="1.5" />
      <g clipPath="url(#vcw-emblem-frame)">
        {rays.map((angle) => {
          const radians = (angle * Math.PI) / 180;
          return (
            <line
              key={angle}
              x1="180"
              y1="100"
              x2={180 + Math.cos(radians) * 200}
              y2={100 + Math.sin(radians) * 200}
              stroke="#c9a45c"
              strokeOpacity="0.14"
              strokeWidth="1"
            />
          );
        })}
      </g>
      <text
        x="180"
        y="102"
        textAnchor="middle"
        fontFamily="Futura, 'Avenir Next', 'Century Gothic', 'Segoe UI', system-ui, sans-serif"
        fontSize="74"
        fontWeight="700"
        letterSpacing="8"
        fill="url(#vcw-emblem-gold)"
      >
        VC
      </text>
      <line x1="60" y1="116" x2="300" y2="116" stroke="url(#vcw-emblem-gold)" strokeWidth="1" />
      <text
        x="180"
        y="144"
        textAnchor="middle"
        fontFamily="Futura, 'Avenir Next', 'Century Gothic', 'Segoe UI', system-ui, sans-serif"
        fontSize="22"
        fontWeight="600"
        letterSpacing="11"
        fill="url(#vcw-emblem-gold)"
      >
        WRITER
      </text>
      <path d="M180 154 L188 163 L180 172 L172 163 Z" fill="#8b1c1c" stroke="url(#vcw-emblem-gold)" strokeWidth="1" />
    </svg>
  );
}
