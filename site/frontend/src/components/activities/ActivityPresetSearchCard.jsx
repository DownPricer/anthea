import React from 'react';
import { useTranslation } from 'react-i18next';
import { getModeBadgeLabelKey } from '../../lib/activities/activityPresetSearch';

/** Carte compacte alignée sur les cartes catalogue (pas de navigation). */
export function ActivityPresetSearchCard({ preset, onSelect, disabled = false }) {
  const { t } = useTranslation(['activity', 'workouts']);

  return (
    <button
      type="button"
      onClick={() => onSelect(preset)}
      disabled={disabled}
      data-testid="activity-preset-search-card"
      className="flex w-full max-w-full min-w-0 items-center gap-3 rounded-xl bg-hover p-3 text-left transition-colors hover:bg-active overflow-hidden"
    >
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-active text-xl"
        aria-hidden
      >
        {preset.icon}
      </div>
      <div className="min-w-0 flex-1 max-w-full overflow-hidden">
        <p className="text-foreground font-medium truncate max-w-full">
          {preset.label}
          <span className="ml-2 text-[10px] uppercase tracking-wide text-subtle">
            {t(getModeBadgeLabelKey(preset.mode), { defaultValue: preset.mode })}
          </span>
        </p>
        <p className="text-subtle text-sm line-clamp-2 break-words [overflow-wrap:anywhere]">
          {t('workouts:create.activitySearch.fitmatchActivity')}
        </p>
      </div>
    </button>
  );
}
