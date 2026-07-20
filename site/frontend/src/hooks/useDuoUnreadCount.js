import { useState, useEffect, useCallback } from 'react';
import { notificationsApi } from '../lib/api';

/**
 * Compteur de notifications Duo non lues (types ^duo_).
 */
export function useDuoUnreadCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { data } = await notificationsApi.unreadCount('duo');
      setCount(data?.count || 0);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onRead = () => refresh();
    window.addEventListener('notifications:read', onRead);
    return () => window.removeEventListener('notifications:read', onRead);
  }, [refresh]);

  const badge = count > 9 ? '9+' : count > 0 ? String(count) : null;
  return { count, badge, refresh };
}
