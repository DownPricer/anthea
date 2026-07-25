/**
 * Bannière de récupération d'activité en cours
 * Affiche quand une activité est déjà en cours (locale ou serveur)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';

export function ActivityRecoveryBanner({ 
  activityName, 
  onResume, 
  onComplete, 
  onDiscard,
  className = '',
}) {
  const { t } = useTranslation('activity');

  return (
    <div
      className={`rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={20} />
        <div className="flex-1 min-w-0">
          <h4 className="text-foreground font-medium mb-1">
            {t('recovery.title')}
          </h4>
          <p className="text-muted text-sm mb-3">
            {t('recovery.message', { name: activityName || t('recovery.unnamed') })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={onResume}
              className="bg-[var(--theme-primary)] text-foreground"
            >
              {t('recovery.resume')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onComplete}
              className="border-border text-foreground"
            >
              {t('recovery.complete')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDiscard}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              {t('recovery.discard')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
