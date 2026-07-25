/**
 * Dialog de partage d'activité
 * Configure visibilité et options de tracé
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Users, Lock, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { VISIBILITY_OPTIONS, ROUTE_SHARE_OPTIONS } from '../../lib/activities/constants';

export function ShareActivityDialog({ 
  open, 
  onOpenChange, 
  onConfirm,
  hasRoute = false,
  loading = false,
}) {
  const { t } = useTranslation('activity');

  const [visibility, setVisibility] = useState(VISIBILITY_OPTIONS.PRIVATE);
  const [routeOption, setRouteOption] = useState(ROUTE_SHARE_OPTIONS.SUMMARY_ONLY);
  const [fullRouteConfirmed, setFullRouteConfirmed] = useState(false);

  const handleConfirm = () => {
    onConfirm({ visibility, routeOption });
  };

  const needsFullRouteConfirmation = routeOption === ROUTE_SHARE_OPTIONS.FULL && !fullRouteConfirmed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {t('share.title')}
          </DialogTitle>
          <DialogDescription className="text-muted">
            {t('share.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Visibilité */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              {t('share.visibility')}
            </label>
            <div className="space-y-2">
              <VisibilityOption
                icon={<Globe size={18} />}
                label={t('share.visibilityOptions.public')}
                description={t('share.visibilityOptions.publicDesc')}
                selected={visibility === VISIBILITY_OPTIONS.PUBLIC}
                onClick={() => setVisibility(VISIBILITY_OPTIONS.PUBLIC)}
              />
              <VisibilityOption
                icon={<Users size={18} />}
                label={t('share.visibilityOptions.friends')}
                description={t('share.visibilityOptions.friendsDesc')}
                selected={visibility === VISIBILITY_OPTIONS.FRIENDS}
                onClick={() => setVisibility(VISIBILITY_OPTIONS.FRIENDS)}
              />
              <VisibilityOption
                icon={<Lock size={18} />}
                label={t('share.visibilityOptions.private')}
                description={t('share.visibilityOptions.privateDesc')}
                selected={visibility === VISIBILITY_OPTIONS.PRIVATE}
                onClick={() => setVisibility(VISIBILITY_OPTIONS.PRIVATE)}
              />
            </div>
          </div>

          {/* Options de tracé */}
          {hasRoute && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                {t('share.routeOptions')}
              </label>
              <div className="space-y-2">
                <RouteOption
                  label={t('share.routeOptionLabels.summaryOnly')}
                  description={t('share.routeOptionLabels.summaryOnlyDesc')}
                  selected={routeOption === ROUTE_SHARE_OPTIONS.SUMMARY_ONLY}
                  onClick={() => {
                    setRouteOption(ROUTE_SHARE_OPTIONS.SUMMARY_ONLY);
                    setFullRouteConfirmed(false);
                  }}
                />
                <RouteOption
                  label={t('share.routeOptionLabels.trimmed')}
                  description={t('share.routeOptionLabels.trimmedDesc')}
                  selected={routeOption === ROUTE_SHARE_OPTIONS.TRIMMED}
                  onClick={() => {
                    setRouteOption(ROUTE_SHARE_OPTIONS.TRIMMED);
                    setFullRouteConfirmed(false);
                  }}
                />
                <RouteOption
                  label={t('share.routeOptionLabels.full')}
                  description={t('share.routeOptionLabels.fullDesc')}
                  selected={routeOption === ROUTE_SHARE_OPTIONS.FULL}
                  onClick={() => setRouteOption(ROUTE_SHARE_OPTIONS.FULL)}
                  warning
                />
              </div>

              {routeOption === ROUTE_SHARE_OPTIONS.FULL && (
                <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={16} />
                    <div className="flex-1">
                      <p className="text-red-400 text-sm mb-2">
                        {t('share.fullRouteWarning')}
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fullRouteConfirmed}
                          onChange={(e) => setFullRouteConfirmed(e.target.checked)}
                          className="rounded border-red-500/50 bg-transparent"
                        />
                        <span className="text-red-400 text-xs">
                          {t('share.fullRouteConfirm')}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-border text-foreground"
          >
            {t('share.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || needsFullRouteConfirmation}
            className="bg-[var(--theme-primary)] text-foreground"
          >
            {loading ? t('share.publishing') : t('share.publish')}
          </Button>
          <Button
            variant="outline"
            onClick={() => onConfirm({ visibility: VISIBILITY_OPTIONS.PRIVATE, routeOption, skipPublish: true })}
            disabled={loading}
            className="border-border text-muted"
          >
            {t('share.saveWithoutPublish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VisibilityOption({ icon, label, description, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        selected
          ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/10'
          : 'border-border bg-hover hover:bg-active'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={selected ? 'text-[var(--theme-primary)]' : 'text-muted'}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-foreground font-medium text-sm">{label}</p>
          <p className="text-subtle text-xs mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  );
}

function RouteOption({ label, description, selected, onClick, warning = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        selected
          ? warning
            ? 'border-red-500/50 bg-red-500/10'
            : 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/10'
          : 'border-border bg-hover hover:bg-active'
      }`}
    >
      <p className={`font-medium text-sm ${warning && selected ? 'text-red-400' : 'text-foreground'}`}>
        {label}
      </p>
      <p className="text-subtle text-xs mt-0.5">{description}</p>
    </button>
  );
}
