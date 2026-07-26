/**
 * Au boot : restaure automatiquement le Player / live sans dialogue.
 */

import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { activitiesApi } from '../../lib/api';
import { getActiveActivity } from '../../lib/activities/activityStore';
import { mergeLocalAndServer } from '../../lib/activities/activityCheckpoint';

function isTrackable(activity) {
  return activity && ['active', 'paused'].includes(activity.status);
}

export function ActivityBootRecovery() {
  const navigate = useNavigate();
  const location = useLocation();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    const path = location.pathname || '';
    if (
      path.startsWith('/player/') ||
      path.startsWith('/activity/') ||
      path === '/login' ||
      path === '/register'
    ) {
      return;
    }
    ranRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        let server = null;
        try {
          const { data } = await activitiesApi.getCurrent();
          server = data?.activity || null;
        } catch {
          /* offline / auth */
        }
        const local = await getActiveActivity().catch(() => null);
        const localAsActivity = local
          ? {
              id: local.activity_id || (local.id !== 'current' ? local.id : null),
              status: local.status || local.clock?.status,
              scheduled_workout_id: local.scheduled_workout_id,
              workout_exercise_index: local.workout_exercise_index,
              updated_at: local.updated_at,
              started_at: local.started_at || local.clock?.startedAt,
              paused_at: local.paused_at || local.clock?.pausedAt,
            }
          : null;

        const { activity } = mergeLocalAndServer(
          isTrackable(localAsActivity) ? localAsActivity : null,
          isTrackable(server) ? server : null,
        );
        if (cancelled || !isTrackable(activity) || !activity.id) return;

        if (activity.scheduled_workout_id) {
          navigate(`/player/${activity.scheduled_workout_id}`, {
            replace: false,
            state: { activityRestored: true },
          });
          return;
        }
        navigate(`/activity/${activity.id}/live`, {
          replace: false,
          state: { activityRestored: true },
        });
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate]);

  return null;
}
