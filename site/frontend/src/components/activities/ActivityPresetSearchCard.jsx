import React from 'react';
import { useTranslation } from 'react-i18next';
import { getModeBadgeLabelKey } from '../../lib/activities/activityPresetSearch';

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
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-background text-2xl"
        aria-hidden
      >
        {preset.icon}
      </div>
      <div className="min-w-0 flex-1 max-w-full overflow-hidden">
        <div className="flex min-w-0 items-start gap-2">
          <p className="min-w-0 flex-1 text-sm font-medium text-foreground line-clamp-2 break-words">
            {preset.label}
          </p>
          <span className="shrink-0 rounded-md bg-[var(--theme-primary)]/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--theme-primary)]">
            {t(getModeBadgeLabelKey(preset.mode), { defaultValue: preset.mode })}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-subtle truncate max-w-full">
          {t('workouts:create.activitySearch.fitmatchActivity')}
        </p>
      </div>
    </button>
  );
}
