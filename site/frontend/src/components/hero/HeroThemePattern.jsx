const THEMES = {
  default: {
    colors: ['#1e293b', '#334155', '#64748b'],
    pattern: 'angles',
    corner: 'bottom-left',
  },
  spiderman: {
    colors: ['#7f1d1d', '#0b1b3a', '#f5f0e8'],
    pattern: 'web',
    corner: 'top-right',
  },
  thor: {
    colors: ['#1e3a5f', '#c0c7d1', '#f8fafc'],
    pattern: 'lightning',
    corner: 'top-right',
  },
  shangchi: {
    colors: ['#7f1d1d', '#c9a227', '#0a0a0a'],
    pattern: 'rings',
    corner: 'top-right',
  },
  deadpool: {
    colors: ['#7f1d1d', '#111111', '#8a93a0'],
    pattern: 'slash',
    corner: 'top-right',
  },
  wolverine: {
    colors: ['#b45309', '#111111', '#9ca3af'],
    pattern: 'claws',
    corner: 'top-right',
  },
  batman: {
    colors: ['#1f242b', '#0a0a0a', '#9ca3af', '#eab308'],
    pattern: 'angles',
    corner: 'bottom-left',
  },
  superman: {
    colors: ['#1d4ed8', '#7f1d1d', '#c9a227'],
    pattern: 'rays',
    corner: 'top-right',
  },
  wonderwoman: {
    colors: ['#7f1d1d', '#1e3a5f', '#c9a227'],
    pattern: 'stars',
    corner: 'top-left',
  },
  aquaman: {
    colors: ['#115e59', '#c9a227', '#1d4ed8'],
    pattern: 'waves',
    corner: 'bottom-right',
  },
  blackadam: {
    colors: ['#0a0a0a', '#d4a017'],
    pattern: 'energy',
    corner: 'top-right',
  },
  captainmarvel: {
    colors: ['#0b1b3a', '#b91c1c', '#c9a227'],
    pattern: 'streaks',
    corner: 'top-right',
  },
};

const CORNER_CLASS = {
  'top-right': 'right-0 top-0 h-[42%] w-[46%]',
  'top-left': 'left-0 top-0 h-[38%] w-[42%]',
  'bottom-right': 'bottom-0 right-0 h-[36%] w-[44%]',
  'bottom-left': 'bottom-0 left-0 h-[34%] w-[40%]',
};

function PatternSvg({ pattern }) {
  switch (pattern) {
    case 'web':
      return (
        <>
          <circle cx="88" cy="12" r="22" fill="none" stroke="white" strokeWidth="0.5" />
          <circle cx="88" cy="12" r="36" fill="none" stroke="white" strokeWidth="0.35" />
          {[0, 45, 90, 135].map((deg) => (
            <line
              key={deg}
              x1="88"
              y1="12"
              x2={88 + 52 * Math.cos((deg * Math.PI) / 180)}
              y2={12 + 52 * Math.sin((deg * Math.PI) / 180)}
              stroke="white"
              strokeWidth="0.35"
            />
          ))}
        </>
      );
    case 'lightning':
      return (
        <path
          d="M58 4 L72 28 L64 28 L82 58 L68 36 L76 36 Z"
          fill="none"
          stroke="white"
          strokeWidth="1"
        />
      );
    case 'rings':
      return (
        <>
          <circle cx="72" cy="18" r="10" fill="none" stroke="#c9a227" strokeWidth="0.9" />
          <circle cx="72" cy="18" r="16" fill="none" stroke="#c9a227" strokeWidth="0.5" />
        </>
      );
    case 'slash':
      return (
        <>
          <line x1="8" y1="0" x2="28" y2="58" stroke="white" strokeWidth="4" opacity="0.2" />
          <line x1="22" y1="0" x2="42" y2="58" stroke="white" strokeWidth="1.5" opacity="0.25" />
        </>
      );
    case 'claws':
      return (
        <>
          <line x1="18" y1="4" x2="34" y2="54" stroke="#fbbf24" strokeWidth="1.5" />
          <line x1="32" y1="2" x2="48" y2="56" stroke="#fbbf24" strokeWidth="1.5" />
          <line x1="46" y1="4" x2="62" y2="54" stroke="#fbbf24" strokeWidth="1.5" />
        </>
      );
    case 'angles':
      return <path d="M0 0 L48 0 L24 42 Z" fill="white" opacity="0.1" />;
    case 'rays':
      return (
        <>
          {[62, 74, 86].map((x) => (
            <line key={x} x1="74" y1="58" x2={x} y2="0" stroke="white" strokeWidth="0.8" />
          ))}
        </>
      );
    case 'stars':
      return (
        <polygon
          points="18,10 20,16 27,16 22,20 24,26 18,22 12,26 14,20 9,16 16,16"
          fill="#c9a227"
          opacity="0.45"
        />
      );
    case 'waves':
      return (
        <path d="M0 36 Q24 24 48 36 T96 36" fill="none" stroke="white" strokeWidth="0.9" />
      );
    case 'energy':
      return (
        <path d="M44 2 L52 22 L48 22 L58 48 L40 26 L46 26 Z" fill="#d4a017" opacity="0.35" />
      );
    case 'streaks':
      return (
        <>
          <line x1="0" y1="14" x2="96" y2="6" stroke="#c9a227" strokeWidth="1" />
          <line x1="0" y1="34" x2="96" y2="24" stroke="white" strokeWidth="0.6" />
        </>
      );
    default:
      return null;
  }
}

export function HeroThemePattern({ themeId = 'default', className = '' }) {
  const theme = THEMES[themeId] || THEMES.default;
  const [a, b] = theme.colors;
  const cornerClass = CORNER_CLASS[theme.corner] || CORNER_CLASS['top-right'];

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(160deg, ${a} 0%, ${b} 70%, rgba(0,0,0,0.55) 100%)`,
        }}
      />
      <svg
        className={`absolute opacity-[0.12] ${cornerClass}`}
        viewBox="0 0 96 60"
        preserveAspectRatio="xMaxYMin meet"
      >
        <PatternSvg pattern={theme.pattern} />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
    </div>
  );
}
