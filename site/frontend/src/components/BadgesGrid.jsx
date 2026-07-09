import { Trophy, Flame, Heart, Target, Medal, Zap, Crown, Star, MessageCircle, Users } from 'lucide-react';
import { ShareBadgeButton } from './social/ShareBadgeDialog';

const ICON_MAP = {
  trophy: Trophy,
  flame: Flame,
  heart: Heart,
  target: Target,
  medal: Medal,
  zap: Zap,
  crown: Crown,
  star: Star,
  message: MessageCircle,
  users: Users,
};

export function BadgesGrid({ badges = [], compact = false, showShare = false }) {
  if (!badges.length) return null;

  const families = [...new Set(badges.map((b) => b.family || 'other'))];

  return (
    <div className="space-y-4">
      {families.map((family) => {
        const familyBadges = badges.filter((b) => (b.family || 'other') === family);
        return (
          <div key={family} className="w-full">
            {!compact && (
              <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2 text-center sm:text-left">
                {familyLabel(family)}
              </p>
            )}
            <div
              className={`grid gap-2 justify-items-center mx-auto w-full max-w-md ${
                compact ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4'
              }`}
            >
              {familyBadges.map((badge) => {
                const Icon = ICON_MAP[badge.icon] || Trophy;
                const unlocked = badge.unlocked;
                return (
                  <div
                    key={badge.id}
                    title={`${badge.name} — ${badge.description || ''}`}
                    className={`relative rounded-2xl p-3 text-center border transition-all ${
                      unlocked
                        ? 'bg-[var(--theme-surface-active)] border-[var(--theme-primary)]/40'
                        : 'bg-[#0A0A0A]/80 border-white/5 opacity-60 grayscale'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-1.5 ${
                        unlocked ? 'bg-[var(--theme-primary)]/20' : 'bg-white/5'
                      }`}
                    >
                      <Icon
                        size={compact ? 18 : 22}
                        className={unlocked ? 'text-[var(--theme-primary)]' : 'text-zinc-600'}
                      />
                    </div>
                    <p className={`text-[10px] leading-tight font-medium ${unlocked ? 'text-white' : 'text-zinc-500'}`}>
                      {badge.name}
                    </p>
                    {!unlocked && (badge.target || 0) > 1 && (
                      <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-zinc-600 rounded-full"
                          style={{ width: `${badge.progress || 0}%` }}
                        />
                      </div>
                    )}
                    {unlocked && (
                      <span className="absolute top-1 right-1 text-[8px] text-[var(--theme-primary)]">✓</span>
                    )}
                    {unlocked && showShare && (
                      <div className="mt-1">
                        <ShareBadgeButton badge={badge} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function familyLabel(family) {
  const labels = {
    regularity: 'Régularité',
    volume: 'Volume',
    duo: 'Duo',
    coach: 'Coach',
    challenge: 'Défis',
    other: 'Autres',
  };
  return labels[family] || family;
}
