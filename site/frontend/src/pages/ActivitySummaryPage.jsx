/**
 * Page de résumé d'activité
 * Affiche métriques, tracé, options de partage/modification/suppression
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  Share2, 
  Edit, 
  Trash2, 
  MapPin,
  Clock,
  Zap,
  Navigation,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { ActivityRoutePreview } from '../components/activities/ActivityRoutePreview';
import { ShareActivityDialog } from '../components/activities/ShareActivityDialog';
import { 
  formatElapsed, 
  formatDistanceMeters, 
  formatPace,
  formatSpeedKmh,
} from '../lib/activities/formatActivity';
import { calculateMovingDistance, calculateAveragePace } from '../lib/activities/geo';
import { TRACKING_MODES } from '../lib/activities/constants';
import { activitiesApi, formatApiError } from '../lib/api';
import { clearActiveActivity } from '../lib/activities/activityStore';
import { toast } from 'sonner';

export function ActivitySummaryPage() {
  const { activityId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['activity', 'common']);

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [editDistanceDialogOpen, setEditDistanceDialogOpen] = useState(false);
  const [deleteRouteDialogOpen, setDeleteRouteDialogOpen] = useState(false);
  const [editedDistance, setEditedDistance] = useState(0);
  const [saving, setSaving] = useState(false);

  const loadActivity = useCallback(async () => {
    try {
      const { data } = await activitiesApi.getOne(activityId);
      setActivity(data);
      setEditedDistance(data.distance_meters || 0);
    } catch (error) {
      toast.error(formatApiError(error));
      navigate('/workouts');
    } finally {
      setLoading(false);
    }
  }, [activityId, navigate, t]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const handleShare = async (shareOptions) => {
    setSaving(true);
    try {
      const payload = {
        visibility: shareOptions.visibility || 'private',
        route_visibility: shareOptions.routeOption || 'summary_only',
        confirm_full_route: shareOptions.routeOption === 'full_route',
      };
      await activitiesApi.publish(activityId, payload);
      toast.success(t('activity:summary.published'));
      await clearActiveActivity();
      navigate('/workouts');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
      setShareDialogOpen(false);
    }
  };

  const handleSaveDistance = async () => {
    setSaving(true);
    try {
      await activitiesApi.updateMetrics(activityId, { distance_meters: editedDistance });
      toast.success(t('activity:summary.distanceUpdated'));
      loadActivity();
      setEditDistanceDialogOpen(false);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoute = async () => {
    setSaving(true);
    try {
      await activitiesApi.deleteRoute(activityId);
      toast.success(t('activity:summary.routeDeleted'));
      loadActivity();
      setDeleteRouteDialogOpen(false);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteActivity = async () => {
    if (!window.confirm(t('activity:summary.confirmDelete'))) return;

    try {
      await activitiesApi.delete(activityId);
      await clearActiveActivity();
      toast.success(t('activity:summary.deleted'));
      navigate('/workouts');
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-primary)]" />
      </div>
    );
  }

  const hasRoute = Boolean(
    activity?.route_preview?.coordinates?.length ||
      activity?.shareable?.simplified_route?.coordinates?.length ||
      (activity?.route_point_count && activity.route_point_count > 0)
  );
  const distance = activity?.distance_meters || 0;
  
  const pace = activity?.average_pace_seconds_per_km
    ? activity.average_pace_seconds_per_km / 60
    : (distance > 0 && activity?.moving_seconds > 0
      ? calculateAveragePace(distance, activity.moving_seconds)
      : null);

  const speed = distance > 0 && activity?.moving_seconds > 0
    ? (distance / 1000) / (activity.moving_seconds / 3600)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-surface border-b border-border p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-active rounded-full transition-colors"
            >
              <ArrowLeft className="text-foreground" size={20} />
            </button>
            <h1 className="text-lg font-medium text-foreground flex-1 mx-3 truncate">
              {activity?.name}
            </h1>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Métriques principales */}
          <div className="grid grid-cols-2 gap-4">
            {activity?.tracking_mode !== TRACKING_MODES.TIMER && (
              <SummaryMetric
                icon={<MapPin size={18} />}
                label={t('activity:metrics.distance')}
                value={formatDistanceMeters(distance)}
              />
            )}

            <SummaryMetric
              icon={<Clock size={18} />}
              label={t('activity:metrics.duration')}
              value={formatElapsed(activity?.elapsed_seconds || 0)}
            />

            {activity?.tracking_mode === TRACKING_MODES.GPS && (
              <>
                <SummaryMetric
                  icon={<Zap size={18} />}
                  label={t('activity:metrics.pace')}
                  value={formatPace(pace)}
                />
                <SummaryMetric
                  icon={<Navigation size={18} />}
                  label={t('activity:metrics.speed')}
                  value={formatSpeedKmh(speed)}
                />
              </>
            )}

            {activity?.tracking_mode === TRACKING_MODES.LAPS && (
              <SummaryMetric
                label={t('activity:metrics.laps')}
                value={`${activity.laps?.length || 0} ${t('activity:metrics.lapsUnit')}`}
              />
            )}
          </div>

          {/* Tracé GPS */}
          {hasRoute && (
            <div className="space-y-3">
              <h2 className="text-foreground font-medium">{t('activity:summary.route')}</h2>
              <ActivityRoutePreview
                points={activity.gps_points}
                width={600}
                height={300}
                className="w-full"
                showMap={false}
              />
              <Button
                onClick={() => setDeleteRouteDialogOpen(true)}
                variant="outline"
                size="sm"
                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 size={16} className="mr-2" />
                {t('activity:summary.deleteRoute')}
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={() => setShareDialogOpen(true)}
              className="w-full bg-[var(--theme-primary)] text-foreground"
              size="lg"
            >
              <Share2 size={20} className="mr-2" />
              {t('activity:summary.saveAndPublish')}
            </Button>

            {activity?.tracking_mode !== TRACKING_MODES.TIMER && (
              <Button
                onClick={() => setEditDistanceDialogOpen(true)}
                variant="outline"
                className="w-full border-border text-foreground"
              >
                <Edit size={18} className="mr-2" />
                {t('activity:summary.editDistance')}
              </Button>
            )}

            <Button
              onClick={handleDeleteActivity}
              variant="outline"
              className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 size={18} className="mr-2" />
              {t('activity:summary.deleteActivity')}
            </Button>
          </div>

          {/* Info */}
          <div className="text-center text-subtle text-sm">
            <p>{t('activity:summary.defaultPrivate')}</p>
          </div>
        </div>
      </div>

      {/* Share Dialog */}
      <ShareActivityDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        onConfirm={handleShare}
        hasRoute={hasRoute}
        loading={saving}
      />

      {/* Edit Distance Dialog */}
      <Dialog open={editDistanceDialogOpen} onOpenChange={setEditDistanceDialogOpen}>
        <DialogContent className="sm:max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {t('activity:summary.editDistance')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('activity:metrics.distance')} (mètres)
            </label>
            <Input
              type="number"
              value={editedDistance}
              onChange={(e) => setEditedDistance(parseInt(e.target.value) || 0)}
              min="0"
              step="100"
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDistanceDialogOpen(false)}
              disabled={saving}
            >
              {t('common:cancel')}
            </Button>
            <Button
              onClick={handleSaveDistance}
              disabled={saving}
              className="bg-[var(--theme-primary)] text-foreground"
            >
              {saving ? t('common:saving') : t('common:save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Route Dialog */}
      <Dialog open={deleteRouteDialogOpen} onOpenChange={setDeleteRouteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {t('activity:summary.deleteRoute')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted text-sm">
              {t('activity:summary.deleteRouteConfirm')}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteRouteDialogOpen(false)}
              disabled={saving}
            >
              {t('common:cancel')}
            </Button>
            <Button
              onClick={handleDeleteRoute}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saving ? t('common:deleting') : t('common:delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryMetric({ icon, label, value }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-subtle mb-2">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-foreground font-bold text-xl">{value}</p>
    </div>
  );
}
