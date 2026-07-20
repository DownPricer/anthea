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
  trophy: '★',
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
 * Artwork SVG — viewBox stable, jamais plus grand que le conteneur.
 */
export function BadgeArtwork({
  rarity = 'common',
  iconKey = 'trophy',
  locked = false,
  size = 48,
  className = '',
}) {
  const palette = resolveRarity(rarity);
  const glyph = ICON_GLYPHS[iconKey] || ICON_GLYPHS.trophy;
  const showCrystals = !locked && (palette.key === 'epic' || palette.key === 'legendary' || palette.key === 'rare');
  const showSparkle = !locked && palette.key === 'legendary';
  const uid = `ba-${palette.key}-${iconKey}`.replace(/[^a-z0-9-]/gi, '');
  const px = typeof size === 'number' ? size : 48;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      style={{ width: px, height: px, maxWidth: '100%' }}
      data-testid="badge-artwork"
      data-rarity={palette.key}
      data-locked={locked ? 'true' : 'false'}
    >
      <svg
        viewBox="0 0 120 120"
        width="100%"
        height="100%"
        className={`block max-w-full max-h-full ${locked ? 'opacity-55 grayscale-[0.65]' : ''}`}
        aria-hidden
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id={`${uid}-bg`} cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor={palette.accent} stopOpacity={locked ? 0.15 : 0.4} />
            <stop offset="100%" stopColor={palette.fill} stopOpacity={locked ? 0.08 : 0.18} />
          </radialGradient>
          <linearGradient id={`${uid}-trophy`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={locked ? '#9CA3AF' : palette.accent} />
            <stop offset="100%" stopColor={locked ? '#6B7280' : palette.fill} />
          </linearGradient>
        </defs>

        <circle cx="60" cy="60" r="50" fill={`url(#${uid}-bg)`} />
        <circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke={palette.fill}
          strokeOpacity={locked ? 0.25 : 0.65}
          strokeWidth={palette.key === 'common' ? 1.5 : 2}
        />

        {showCrystals && (
          <g opacity={palette.key === 'rare' ? 0.5 : 0.8}>
            <polygon points="22,44 26,34 30,44" fill={palette.crystal} />
            <polygon points="90,40 94,30 98,40" fill={palette.crystal} />
            {(palette.key === 'epic' || palette.key === 'legendary') && (
              <>
                <polygon points="24,78 28,88 32,78" fill={palette.crystal} opacity="0.7" />
                <polygon points="88,80 94,70 100,80" fill={palette.crystal} />
              </>
            )}
            {palette.key === 'legendary' && (
              <circle cx="60" cy="24" r="2.5" fill="#FFF8E7" />
            )}
          </g>
        )}

        <g>
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

        {showSparkle && (
          <g className="badge-sparkle">
            <circle cx="34" cy="30" r="1.5" fill="#FFF8E7">
              <animate attributeName="opacity" values="0.2;1;0.2" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx="86" cy="52" r="1.2" fill="#FFF8E7">
              <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite" />
            </circle>
          </g>
        )}
      </svg>

      {locked && (
        <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 border border-white/10">
          <Lock size={8} className="text-zinc-400" />
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
