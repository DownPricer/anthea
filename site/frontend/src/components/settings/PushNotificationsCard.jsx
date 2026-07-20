import { useState, useEffect, useCallback } from 'react';
import { Bell, Loader2, Smartphone } from 'lucide-react';
import { Button } from '../ui/button';
import {
  setupPushNotifications,
  disablePushNotifications,
  getDevicePushStatus,
  sendTestPush,
  ensureServiceWorker,
} from '../../lib/pushNotifications';
import { isPushConfigured } from '../../lib/env';
import { toast } from 'sonner';

/**
 * Carte Paramètres — notifications Web Push sur cet appareil.
 * Ne demande jamais la permission au chargement.
 */
export function PushNotificationsCard() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const refresh = useCallback(async () => {
    if (isPushConfigured()) {
      await ensureServiceWorker().catch(() => null);
    }
    const s = await getDevicePushStatus();
    setStatus(s);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const r = await setupPushNotifications();
      if (r.ok) {
        toast.success('Notifications activées sur cet appareil');
      } else if (r.reason === 'denied') {
        toast.info('Autorisez les notifications dans les réglages du navigateur');
      } else if (r.reason === 'ios_install_required') {
        toast.info(r.hint || 'Installez l’application sur l’écran d’accueil');
      } else if (r.reason === 'unsupported') {
        toast.error('Notifications non prises en charge sur ce navigateur');
      } else if (r.reason === 'not_configured') {
        toast.error('Push non configuré côté serveur');
      } else {
        toast.error("Impossible d'activer les notifications");
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await disablePushNotifications();
      toast.success('Notifications désactivées sur cet appareil');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await sendTestPush();
      toast.success('Notification de test envoyée — fermez l’onglet pour vérifier');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Échec de la notification de test');
    } finally {
      setTesting(false);
    }
  };

  if (!status) {
    return (
      <div className="rounded-xl bg-white/5 p-3 flex items-center gap-3">
        <Loader2 className="animate-spin text-zinc-500" size={18} />
        <span className="text-zinc-500 text-sm">Chargement…</span>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl bg-white/5 p-4 space-y-3"
      data-testid="push-notifications-card"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--theme-surface-active)] flex items-center justify-center shrink-0">
          <Smartphone className="text-[var(--theme-primary)]" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium flex items-center gap-2">
            <Bell size={14} className="text-zinc-400" />
            Notifications sur cet appareil
          </p>
          <p className="text-zinc-500 text-xs mt-1">
            Recevez les rappels et activités même lorsque l’application est fermée.
          </p>
          <p className="text-zinc-400 text-xs mt-2">
            État : <span className="text-white">{status.label}</span>
          </p>
          {status.hint ? (
            <p className="text-amber-400/80 text-xs mt-2 leading-relaxed">{status.hint}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {status.canEnable ? (
          <Button
            type="button"
            size="sm"
            className="rounded-xl btn-primary text-white"
            disabled={busy}
            onClick={handleEnable}
            data-testid="push-enable-btn"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : 'Activer les notifications'}
          </Button>
        ) : null}
        {status.canDisable ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl border-white/15 text-white"
              disabled={testing}
              onClick={handleTest}
              data-testid="push-test-btn"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : 'Tester'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-xl text-zinc-400"
              disabled={busy}
              onClick={handleDisable}
            >
              Désactiver
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
