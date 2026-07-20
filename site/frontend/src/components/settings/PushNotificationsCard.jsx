import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Loader2, Smartphone } from 'lucide-react';
import { Button } from '../ui/button';
import {
  setupPushNotifications,
  disablePushNotifications,
  getDevicePushStatus,
  sendTestPush,
  ensureServiceWorker,
  PUSH_STATUS,
} from '../../lib/pushNotifications';
import { isPushConfigured } from '../../lib/env';
import { toast } from 'sonner';

/**
 * Carte Paramètres — notifications Web Push sur cet appareil.
 * Ne demande jamais la permission au chargement.
 */
export function PushNotificationsCard() {
  const { t } = useTranslation(['settings', 'common']);
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

  const displayStatus = useMemo(() => {
    if (!status) return null;
    const statusKey = status.status || 'default';
    const label = t(`settings:pushDevice.statusLabels.${statusKey}`, {
      defaultValue: status.label,
    });
    let hint = status.hint;
    if (statusKey === PUSH_STATUS.UNSUPPORTED) {
      hint = t('settings:pushDevice.hints.unsupported');
    } else if (statusKey === PUSH_STATUS.NOT_CONFIGURED) {
      hint = t('settings:pushDevice.hints.notConfigured');
    } else if (statusKey === PUSH_STATUS.DENIED) {
      hint = status.hint || t('settings:pushDevice.hints.denied');
    } else if (statusKey === PUSH_STATUS.EXPIRED) {
      hint = t('settings:pushDevice.hints.expired');
    } else if (status.hint && statusKey === PUSH_STATUS.DEFAULT) {
      hint = status.hint;
    }
    return { ...status, label, hint };
  }, [status, t]);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const r = await setupPushNotifications();
      if (r.ok) {
        toast.success(t('settings:pushDevice.toasts.enabled'));
      } else if (r.reason === 'denied') {
        toast.info(t('settings:pushDevice.toasts.denied'));
      } else if (r.reason === 'ios_install_required') {
        toast.info(r.hint || t('settings:pushDevice.toasts.iosInstall'));
      } else if (r.reason === 'unsupported') {
        toast.error(t('settings:pushDevice.toasts.unsupported'));
      } else if (r.reason === 'not_configured') {
        toast.error(t('settings:pushDevice.toasts.notConfigured'));
      } else {
        toast.error(t('settings:pushDevice.toasts.enableFailed'));
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
      toast.success(t('settings:pushDevice.toasts.disabled'));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await sendTestPush();
      toast.success(t('settings:pushDevice.toasts.testSent'));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('settings:pushDevice.toasts.testFailed'));
    } finally {
      setTesting(false);
    }
  };

  if (!displayStatus) {
    return (
      <div className="rounded-xl bg-white/5 p-3 flex items-center gap-3">
        <Loader2 className="animate-spin text-zinc-500" size={18} />
        <span className="text-zinc-500 text-sm">{t('common:states.loading')}</span>
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
            {t('settings:pushDevice.title')}
          </p>
          <p className="text-zinc-500 text-xs mt-1">
            {t('settings:pushDevice.hint')}
          </p>
          <p className="text-zinc-400 text-xs mt-2">
            {t('settings:pushDevice.statusLabel')} : <span className="text-white">{displayStatus.label}</span>
          </p>
          {displayStatus.hint ? (
            <p className="text-amber-400/80 text-xs mt-2 leading-relaxed">{displayStatus.hint}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {displayStatus.canEnable ? (
          <Button
            type="button"
            size="sm"
            className="rounded-xl btn-primary text-white"
            disabled={busy}
            onClick={handleEnable}
            data-testid="push-enable-btn"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : t('settings:pushDevice.enable')}
          </Button>
        ) : null}
        {displayStatus.canDisable ? (
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
              {testing ? <Loader2 size={14} className="animate-spin" /> : t('settings:pushDevice.test')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-xl text-zinc-400"
              disabled={busy}
              onClick={handleDisable}
            >
              {t('settings:pushDevice.disable')}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
