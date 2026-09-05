/**
 * The VC Writer wordmark (docs/brand.md).
 *
 * Inline SVG so it scales and ships no asset. A sibling of the VC Film Studio
 * mark — same gold, same stepped frame, same red diamond — rather than a copy.
 */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <svg
        className="wordmark-svg compact"
        viewBox="0 0 220 28"
        width="160"
        height="20"
        role="img"
        aria-label="VC Writer"
      >
        <defs>
          <linearGradient id="vcw-gold-c" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e8c872" />
            <stop offset="1" stopColor="#a8873e" />
          </linearGradient>
        </defs>
        <line x1="0" y1="14" x2="26" y2="14" stroke="url(#vcw-gold-c)" strokeWidth="1" />
        <line x1="194" y1="14" x2="220" y2="14" stroke="url(#vcw-gold-c)" strokeWidth="1" />
        <text
          x="110"
          y="19"
          textAnchor="middle"
          fontFamily="Futura, 'Avenir Next', 'Century Gothic', 'Segoe UI', system-ui, sans-serif"
          fontSize="15"
          fontWeight="600"
          letterSpacing="4"
          fill="url(#vcw-gold-c)"
        >
          VC WRITER
        </text>
      </svg>
    );
  }

  return (
    <svg className="wordmark-svg" viewBox="0 0 360 150" width="360" height="150" role="img" aria-label="VC Writer">
      <defs>
        <linearGradient id="vcw-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efd48a" />
          <stop offset="0.5" stopColor="#c9a45c" />
          <stop offset="1" stopColor="#8a6f2f" />
        </linearGradient>
        <clipPath id="vcw-frame">
          <path d="M18 30 H30 V18 H330 V30 H342 V120 H330 V132 H30 V120 H18 Z" />
        </clipPath>
        <radialGradient id="vcw-burst" cx="0.5" cy="0.15" r="0.7">
          <stop offset="0" stopColor="#c9a45c" stopOpacity="0.22" />
          <stop offset="1" stopColor="#c9a45c" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="360" height="150" fill="url(#vcw-burst)" />

      {/* Stepped frame: outer hairline, inner gold rule. */}
      <path
        d="M10 24 H24 V10 H336 V24 H350 V126 H336 V140 H24 V126 H10 Z"
        fill="none"
        stroke="#8a6f2f"
        strokeWidth="1"
      />
      <path
        d="M18 30 H30 V18 H330 V30 H342 V120 H330 V132 H30 V120 H18 Z"
        fill="none"
        stroke="url(#vcw-gold)"
        strokeWidth="1.5"
      />

      {/* Sunburst rays behind the letters, kept inside the frame. */}
      <g clipPath="url(#vcw-frame)">
      {Array.from({ length: 9 }, (_, index) => {
        const angle = -80 + index * 20;
        const radians = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1="180"
            y1="86"
            x2={180 + Math.cos(radians) * 150}
            y2={86 + Math.sin(radians) * 150}
            stroke="#c9a45c"
            strokeOpacity="0.16"
            strokeWidth="1"
          />
        );
      })}
      </g>

      <text
        x="180"
        y="78"
        textAnchor="middle"
        fontFamily="Futura, 'Avenir Next', 'Century Gothic', 'Segoe UI', system-ui, sans-serif"
        fontSize="54"
        fontWeight="700"
        letterSpacing="6"
        fill="url(#vcw-gold)"
      >
        VC
      </text>
      <line x1="70" y1="90" x2="290" y2="90" stroke="url(#vcw-gold)" strokeWidth="1" />
      <text
        x="180"
        y="112"
        textAnchor="middle"
        fontFamily="Futura, 'Avenir Next', 'Century Gothic', 'Segoe UI', system-ui, sans-serif"
        fontSize="18"
        fontWeight="600"
        letterSpacing="9"
        fill="url(#vcw-gold)"
      >
        WRITER
      </text>

      {/* The deco diamond. */}
      <path d="M180 120 L186 127 L180 134 L174 127 Z" fill="#8b1c1c" stroke="url(#vcw-gold)" strokeWidth="1" />
    </svg>
  );
}
