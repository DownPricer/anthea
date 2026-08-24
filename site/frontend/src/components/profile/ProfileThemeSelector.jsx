import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HERO_THEME_IDS, themeUnlockBadge } from '../../lib/heroChallenges';

export function ProfileThemeSelector({ value = 'default', unlockedBadgeIds = [], onChange }) {
  const { t } = useTranslation(['challenges', 'profile']);
  const unlocked = new Set(unlockedBadgeIds);

  return (
    <div className="space-y-2" data-testid="profile-theme-selector">
      <p className="text-sm font-medium text-foreground">{t('profile:edit.profileTheme')}</p>
      <div className="grid grid-cols-2 gap-2">
        {HERO_THEME_IDS.map((id) => {
          const badge = themeUnlockBadge(id);
          const isUnlocked = id === 'default' || (badge && unlocked.has(badge));
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              disabled={!isUnlocked}
              data-testid={`profile-theme-${id}`}
              onClick={() => isUnlocked && onChange?.(id)}
              className={`relative overflow-hidden rounded-xl border p-3 text-left min-h-[4.5rem] ${
                selected ? 'border-[var(--theme-primary)] ring-1 ring-[var(--theme-primary)]' : 'border-border'
              } ${isUnlocked ? 'bg-surface-elevated' : 'opacity-70 bg-surface'}`}
            >
              <span className="block text-sm font-medium text-foreground">
                {t(`challenges:hero.themes.${id}`)}
              </span>
              {!isUnlocked ? (
                <span className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                  <Lock size={12} aria-hidden />
                  {t('challenges:hero.themeLocked', { name: t(`challenges:hero.themes.${id}`) })}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
