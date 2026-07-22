import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
  mergeNotificationPrefs,
  getNotificationPrefLabels,
} from '../../lib/notificationPrefs';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';

export function NotificationPrefsSection() {
  const { t } = useTranslation(['notifications', 'common']);
  const { user, updateProfile } = useAuth();
  const [prefs, setPrefs] = useState(() => mergeNotificationPrefs(user?.notification_prefs));
  const [savingKeys, setSavingKeys] = useState(() => new Set());
  const prefGroups = getNotificationPrefLabels(t);

  useEffect(() => {
    setPrefs(mergeNotificationPrefs(user?.notification_prefs));
  }, [user?.notification_prefs]);

  const updatePreference = async (key, checked) => {
    const previous = prefs;
    const next = { ...prefs, [key]: Boolean(checked) };
    setPrefs(next);
    setSavingKeys((current) => new Set(current).add(key));
    const result = await updateProfile({ notification_prefs: next });
    setSavingKeys((current) => {
      const updated = new Set(current);
      updated.delete(key);
      return updated;
    });
    if (!result.success) {
      setPrefs(previous);
      toast.error(result.error || t('notifications:prefs.saveError'));
    }
  };

  return (
    <div className="space-y-4" data-testid="notification-prefs-section">
      <p className="text-subtle text-xs">
        {t('notifications:prefs.hint')}
      </p>

      {prefGroups.map((group) => (
        <div key={group.id} className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-subtle font-medium">{group.label}</h3>
          <div className="space-y-1.5">
            {group.keys.map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl bg-hover p-3"
              >
                <span className="text-foreground text-sm min-w-0 leading-snug">{label}</span>
                <Switch
                  checked={!!prefs[key]}
                  onCheckedChange={(checked) => updatePreference(key, checked)}
                  disabled={!user || savingKeys.size > 0}
                  aria-label={label}
                  data-testid={`notif-pref-${key}`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

    </div>
  );
}
