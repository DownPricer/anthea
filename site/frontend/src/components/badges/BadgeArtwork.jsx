import { Lock } from 'lucide-react';

const RARITY_PALETTE = {
  common: {
    key: 'common',
    fill: '#C8CDD4',
    accent: '#9AA3AF',
    glow: 'rgba(200,205,212,0.25)',
    crystal: '#E8EAED',
  },
  rare: {
    key: 'rare',
    fill: '#3B82F6',
    accent: '#93C5FD',
    glow: 'rgba(59,130,246,0.35)',
    crystal: '#60A5FA',
  },
  epic: {
    key: 'epic',
    fill: '#A855F7',
    accent: '#D8B4FE',
    glow: 'rgba(168,85,247,0.4)',
    crystal: '#C084FC',
  },
  legendary: {
    key: 'legendary',
    fill: '#F59E0B',
    accent: '#FDE68A',
    glow: 'rgba(245,158,11,0.45)',
    crystal: '#FBBF24',
  },
};

const LABEL_TO_KEY = {
  Commun: 'common',
  Rare: 'rare',
  Épique: 'epic',
  Légendaire: 'legendary',
  Diamant: 'legendary',
  common: 'common',
  rare: 'rare',
  epic: 'epic',
  legendary: 'legendary',
};

const ICON_GLYPHS = {
  first_step: '1',
  launch: '→',
  habit: '↻',
  calendar: '▦',
  sunrise: '☀',
  moon: '☾',
  timer: '⏱',
  hourglass: '⌛',
  clock: '◷',
  flame: '炎',
  streak: '⚡',
  finish: '✓',
  compass: '◈',
  legs: '🦵',
  strength: '💪',
  heart: '♥',
  mobility: '☯',
  planner: '☰',
  create: '+',
  trophy: '🏆',
  target: '◎',
  crown: '♛',
  duo: '⚭',
  link: '⚭',
  users: '👤',
  lock: '🔒',
};

function resolveRarity(rarity) {
  const key = LABEL_TO_KEY[rarity] || LABEL_TO_KEY[String(rarity || '').toLowerCase()] || 'common';
  return RARITY_PALETTE[key] || RARITY_PALETTE.common;
}

/**
 * Artwork SVG partagé — trophée central + symbole + cristaux selon rareté.
 * Lisible à 48 / 72 / 120 px. Respecte prefers-reduced-motion.
 */
export function BadgeArtwork({
  rarity = 'common',
  iconKey = 'trophy',
  locked = false,
  size = 72,
  className = '',
}) {
  const palette = resolveRarity(rarity);
  const glyph = ICON_GLYPHS[iconKey] || ICON_GLYPHS.trophy;
  const showCrystals = !locked && (palette.key === 'epic' || palette.key === 'legendary' || palette.key === 'rare');
  const showSparkle = !locked && palette.key === 'legendary';
  const uid = `ba-${palette.key}-${iconKey}`.replace(/[^a-z0-9-]/gi, '');

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      data-testid="badge-artwork"
      data-rarity={palette.key}
      data-locked={locked ? 'true' : 'false'}
    >
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        className={locked ? 'opacity-55 grayscale-[0.65]' : ''}
        aria-hidden
      >
        <defs>
          <radialGradient id={`${uid}-bg`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={palette.accent} stopOpacity={locked ? 0.15 : 0.45} />
            <stop offset="100%" stopColor={palette.fill} stopOpacity={locked ? 0.08 : 0.2} />
          </radialGradient>
          <linearGradient id={`${uid}-trophy`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={locked ? '#9CA3AF' : palette.accent} />
            <stop offset="100%" stopColor={locked ? '#6B7280' : palette.fill} />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Halo */}
        {!locked && (
          <circle
            cx="60"
            cy="60"
            r="52"
            fill={`url(#${uid}-bg)`}
            style={{ filter: `drop-shadow(0 0 8px ${palette.glow})` }}
          />
        )}
        {locked && <circle cx="60" cy="60" r="52" fill={`url(#${uid}-bg)`} />}

        {/* Contour */}
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke={palette.fill}
          strokeOpacity={locked ? 0.25 : 0.7}
          strokeWidth={palette.key === 'common' ? 1.5 : 2.5}
        />

        {/* Cristaux rare/épique/légendaire */}
        {showCrystals && (
          <g opacity={palette.key === 'rare' ? 0.55 : 0.85}>
            <polygon points="18,42 24,30 30,42" fill={palette.crystal} />
            <polygon points="90,38 96,26 102,38" fill={palette.crystal} />
            <polygon points="22,78 28,90 34,78" fill={palette.crystal} opacity="0.7" />
            {(palette.key === 'epic' || palette.key === 'legendary') && (
              <>
                <polygon points="86,82 94,70 102,82" fill={palette.crystal} />
                <polygon points="55,14 60,6 65,14" fill={palette.crystal} />
              </>
            )}
            {palette.key === 'legendary' && (
              <>
                <polygon points="48,108 54,98 60,108" fill={palette.accent} />
                <polygon points="60,108 66,98 72,108" fill={palette.crystal} />
                <circle cx="60" cy="22" r="3" fill="#FFF8E7" />
              </>
            )}
          </g>
        )}

        {/* Trophée */}
        <g filter={!locked && palette.key !== 'common' ? `url(#${uid}-glow)` : undefined}>
          <path
            d="M42 38 h36 v6 c0 14-8 24-18 28 v8 h8 v6 H52 v-6 h8 v-8 C50 68 42 58 42 44 z"
            fill={`url(#${uid}-trophy)`}
          />
          <rect x="48" y="86" width="24" height="6" rx="2" fill={`url(#${uid}-trophy)`} />
          <path
            d="M42 42 c-8 2-12 10-10 18 2 6 8 8 12 6"
            fill="none"
            stroke={locked ? '#9CA3AF' : palette.accent}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M78 42 c8 2 12 10 10 18-2 6-8 8-12 6"
            fill="none"
            stroke={locked ? '#9CA3AF' : palette.accent}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>

        {/* Symbole lié au succès */}
        <text
          x="60"
          y="58"
          textAnchor="middle"
          fontSize="14"
          fill={locked ? '#A1A1AA' : '#fff'}
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
        >
          {glyph.length <= 2 ? glyph : '★'}
        </text>

        {/* Scintillement légendaire */}
        {showSparkle && (
          <g className="badge-sparkle">
            <circle cx="34" cy="28" r="1.5" fill="#FFF8E7">
              <animate attributeName="opacity" values="0.2;1;0.2" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx="88" cy="54" r="1.2" fill="#FFF8E7">
              <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite" />
            </circle>
          </g>
        )}
      </svg>

      {locked && (
        <span className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 border border-white/10">
          <Lock size={10} className="text-zinc-400" />
        </span>
      )}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .badge-sparkle animate { animation: none !important; }
          .badge-sparkle circle { opacity: 0.6 !important; }
        }
      `}</style>
    </div>
  );
}

export function normalizeBadgeRarityKey(rarity) {
  return resolveRarity(rarity).key;
}

export { RARITY_PALETTE, LABEL_TO_KEY };
