const THEMES = {
  default: {
    colors: ['#1e293b', '#334155', '#64748b'],
    pattern: 'angles',
  },
  spiderman: {
    colors: ['#7f1d1d', '#0b1b3a', '#f5f0e8'],
    pattern: 'web',
  },
  thor: {
    colors: ['#1e3a5f', '#c0c7d1', '#f8fafc'],
    pattern: 'lightning',
  },
  shangchi: {
    colors: ['#7f1d1d', '#c9a227', '#0a0a0a'],
    pattern: 'rings',
  },
  deadpool: {
    colors: ['#7f1d1d', '#111111', '#8a93a0'],
    pattern: 'slash',
  },
  wolverine: {
    colors: ['#b45309', '#111111', '#9ca3af'],
    pattern: 'claws',
  },
  batman: {
    colors: ['#1f242b', '#0a0a0a', '#9ca3af', '#eab308'],
    pattern: 'angles',
  },
  superman: {
    colors: ['#1d4ed8', '#7f1d1d', '#c9a227'],
    pattern: 'rays',
  },
  wonderwoman: {
    colors: ['#7f1d1d', '#1e3a5f', '#c9a227'],
    pattern: 'stars',
  },
  aquaman: {
    colors: ['#115e59', '#c9a227', '#1d4ed8'],
    pattern: 'waves',
  },
  blackadam: {
    colors: ['#0a0a0a', '#d4a017'],
    pattern: 'energy',
  },
  captainmarvel: {
    colors: ['#0b1b3a', '#b91c1c', '#c9a227'],
    pattern: 'streaks',
  },
};

export function HeroThemePattern({ themeId = 'default', className = '' }) {
  const theme = THEMES[themeId] || THEMES.default;
  const [a, b] = theme.colors;
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`} aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(160deg, ${a} 0%, ${b} 70%, rgba(0,0,0,0.55) 100%)`,
        }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-40" viewBox="0 0 200 120" preserveAspectRatio="none">
        {theme.pattern === 'web' && (
          <>
            <circle cx="100" cy="10" r="40" fill="none" stroke="white" strokeWidth="0.4" />
            <circle cx="100" cy="10" r="70" fill="none" stroke="white" strokeWidth="0.35" />
            <circle cx="100" cy="10" r="100" fill="none" stroke="white" strokeWidth="0.3" />
            {[0, 30, 60, 90, 120, 150].map((deg) => (
              <line
                key={deg}
                x1="100"
                y1="10"
                x2={100 + 140 * Math.cos((deg * Math.PI) / 180)}
                y2={10 + 140 * Math.sin((deg * Math.PI) / 180)}
                stroke="white"
                strokeWidth="0.35"
              />
            ))}
          </>
        )}
        {theme.pattern === 'lightning' && (
          <path d="M40 10 L70 50 L55 50 L90 110 L60 65 L75 65 Z" fill="none" stroke="white" strokeWidth="1.2" />
        )}
        {theme.pattern === 'rings' && (
          <>
            <circle cx="160" cy="30" r="18" fill="none" stroke="#c9a227" strokeWidth="1.4" />
            <circle cx="160" cy="30" r="28" fill="none" stroke="#c9a227" strokeWidth="0.7" />
            <path d="M20 90 Q90 40 170 80" fill="none" stroke="#c9a227" strokeWidth="1" />
          </>
        )}
        {theme.pattern === 'slash' && (
          <>
            <line x1="20" y1="0" x2="80" y2="120" stroke="white" strokeWidth="8" opacity="0.25" />
            <line x1="50" y1="0" x2="110" y2="120" stroke="white" strokeWidth="3" opacity="0.35" />
          </>
        )}
        {theme.pattern === 'claws' && (
          <>
            <line x1="30" y1="10" x2="70" y2="110" stroke="#fbbf24" strokeWidth="3" />
            <line x1="55" y1="5" x2="95" y2="115" stroke="#fbbf24" strokeWidth="3" />
            <line x1="80" y1="8" x2="120" y2="112" stroke="#fbbf24" strokeWidth="3" />
          </>
        )}
        {theme.pattern === 'angles' && (
          <path d="M0 0 L80 0 L40 70 Z M120 120 L200 40 L200 120 Z" fill="white" opacity="0.12" />
        )}
        {theme.pattern === 'rays' && (
          <>
            {[70, 90, 110].map((x) => (
              <line key={x} x1="100" y1="120" x2={x} y2="0" stroke="white" strokeWidth="1.4" />
            ))}
          </>
        )}
        {theme.pattern === 'stars' && (
          <>
            <polygon points="30,20 33,28 42,28 35,33 38,42 30,36 22,42 25,33 18,28 27,28" fill="#c9a227" opacity="0.7" />
            <line x1="0" y1="60" x2="200" y2="60" stroke="white" strokeWidth="0.5" />
          </>
        )}
        {theme.pattern === 'waves' && (
          <path d="M0 70 Q50 40 100 70 T200 70" fill="none" stroke="white" strokeWidth="1.5" />
        )}
        {theme.pattern === 'energy' && (
          <path d="M90 5 L110 50 L100 50 L125 115 L85 60 L98 60 Z" fill="#d4a017" opacity="0.55" />
        )}
        {theme.pattern === 'streaks' && (
          <>
            <line x1="0" y1="30" x2="200" y2="10" stroke="#c9a227" strokeWidth="2" />
            <line x1="0" y1="80" x2="200" y2="50" stroke="white" strokeWidth="1" />
          </>
        )}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
    </div>
  );
}
