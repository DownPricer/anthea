import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { notificationsApi } from '../lib/api';

/**
 * Cloche de notifications réutilisable.
 * @param {'duo'|null} filter - filtre pour le compteur et la navigation
 * @param {boolean} includeAll - si true avec filter duo, compte toutes les non lues
 */
export function NotificationBell({
  filter = null,
  includeAll = false,
  className = '',
  'data-testid': testId = 'notification-bell',
}) {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  const loadCount = useCallback(async () => {
    try {
      const useFilter = filter && !includeAll ? filter : undefined;
      const { data } = await notificationsApi.unreadCount(useFilter);
      setCount(data?.count || 0);
    } catch {
      setCount(0);
    }
  }, [filter, includeAll]);

  useEffect(() => {
    loadCount();
    const onRead = () => loadCount();
    window.addEventListener('notifications:read', onRead);
    return () => window.removeEventListener('notifications:read', onRead);
  }, [loadCount]);

  const badge = count > 9 ? '9+' : count > 0 ? String(count) : null;
  const target = filter === 'duo' ? '/notifications?filter=duo' : '/notifications';

  return (
    <div className={`relative shrink-0 ${className}`}>
      {badge ? (
        <span
          data-testid={`${testId}-badge`}
          className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-1 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white z-10"
        >
          {badge}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => navigate(target)}
        data-testid={testId}
        className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={filter === 'duo' ? 'Notifications duo' : 'Notifications'}
      >
        <Bell size={20} />
      </button>
    </div>
  );
}
