/**
 * Corps d'une publication d'activité dans le feed
 */

import React, { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Clock, Zap } from 'lucide-react';
import { formatElapsed, formatDistanceMeters, formatPace } from '../../lib/activities/formatActivity';
import { routeGeoJsonToLatLonPoints } from '../../lib/activities/geo';

const ActivityRoutePreview = lazy(() => import('./ActivityRoutePreview'));

export function ActivityPostBody({ activity: post }) {
  const { t } = useTranslation('activity');

  if (!post) return null;

  const snapshot = post.activity_snapshot || post;
  const routePoints = routeGeoJsonToLatLonPoints(snapshot.simplified_route);
  const showRoute =
    routePoints.length >= 2 &&
    snapshot.route_visibility &&
    snapshot.route_visibility !== 'summary_only';

  const paceMin =
    snapshot.average_pace_seconds_per_km != null
      ? snapshot.average_pace_seconds_per_km / 60
      : null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-hover border border-border p-4">
        <div className="grid grid-cols-2 gap-4">
          {snapshot.distance_meters != null && snapshot.distance_meters > 0 && (
            <div>
              <p className="text-subtle text-xs mb-1">{t('metrics.distance')}</p>
              <p className="text-foreground font-semibold">
                {formatDistanceMeters(snapshot.distance_meters)}
              </p>
            </div>
          )}

          {snapshot.elapsed_seconds != null && (
            <div>
              <p className="text-subtle text-xs mb-1">{t('metrics.duration')}</p>
              <p className="text-foreground font-semibold flex items-center gap-1">
                <Clock size={14} />
                {formatElapsed(snapshot.elapsed_seconds)}
              </p>
            </div>
          )}

          {paceMin != null && paceMin > 0 && isFinite(paceMin) && (
            <div>
              <p className="text-subtle text-xs mb-1">{t('metrics.pace')}</p>
              <p className="text-foreground font-semibold flex items-center gap-1">
                <Zap size={14} />
                {formatPace(paceMin)}
              </p>
            </div>
          )}

          {snapshot.laps != null && snapshot.laps > 0 && (
            <div>
              <p className="text-subtle text-xs mb-1">{t('metrics.laps')}</p>
              <p className="text-foreground font-semibold">
                {snapshot.laps} {t('metrics.lapsUnit')}
              </p>
            </div>
          )}
        </div>

        {snapshot.activity_kind && (
          <div className="mt-3 pt-3 border-t border-border">
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <MapPin size={12} />
              {t(`kinds.${snapshot.activity_kind}`, { defaultValue: snapshot.activity_kind })}
            </span>
          </div>
        )}
      </div>

      {showRoute && (
        <Suspense fallback={<div className="w-full h-48 bg-hover rounded-xl animate-pulse" />}>
          <ActivityRoutePreview points={routePoints} width={400} height={240} className="w-full" showMap={false} />
        </Suspense>
      )}

      {snapshot.route_visibility === 'trimmed_route' && (
        <p className="text-subtle text-xs">{t('privacy.trimmedRoute')}</p>
      )}
    </div>
  );
}
