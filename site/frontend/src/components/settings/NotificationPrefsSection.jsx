import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  mergeNotificationPrefs,
  NOTIFICATION_PREF_GROUPS,
} from '../../lib/notificationPrefs';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { toast } from 'sonner';

export function NotificationPrefsSection() {
  const { user, updateProfile } = useAuth();
  const [prefs, setPrefs] = useState(() => mergeNotificationPrefs(user?.notification_prefs));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setPrefs(mergeNotificationPrefs(user?.notification_prefs));
    setDirty(false);
  }, [user?.notification_prefs]);

  const setPref = (key, value) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateProfile({ notification_prefs: prefs });
    setSaving(false);
    if (result.success) {
      setDirty(false);
      toast.success('Préférences de notifications enregistrées');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-4" data-testid="notification-prefs-section">
      <p className="text-zinc-500 text-xs">
        Types de notifications — le Push respecte ces choix. Les alertes de sécurité restent toujours actives.
      </p>

      {NOTIFICATION_PREF_GROUPS.map((group) => (
        <div key={group.id} className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium">{group.label}</h3>
          <div className="space-y-1.5">
            {group.keys.map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3"
              >
                <span className="text-white text-sm min-w-0 leading-snug">{label}</span>
                <Switch
                  checked={!!prefs[key]}
                  onCheckedChange={(v) => setPref(key, v)}
                  data-testid={`notif-pref-${key}`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <Button
        type="button"
        onClick={handleSave}
        disabled={saving || !dirty}
        className="w-full h-11 rounded-xl btn-primary text-white"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer les notifications'}
      </Button>
    </div>
  );
}
