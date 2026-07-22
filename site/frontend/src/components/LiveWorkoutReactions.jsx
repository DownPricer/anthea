import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { liveWorkoutApi } from '../lib/api';

const REACTIONS = [
  { emoji: '🔥', labelKey: 'reactions.fire' },
  { emoji: '❤️', labelKey: 'reactions.heart' },
  { emoji: '💪', labelKey: 'reactions.flex' },
];

const SEND_COOLDOWN_MS = 300;
const POLL_MS = 2000;
const FLOAT_MS = 1500;

/**
 * Petite bulle flottante de réactions duo (hors flux).
 */
export function LiveWorkoutReactions({ sessionId, enabled = true }) {
  const { t } = useTranslation('player');
  const [open, setOpen] = useState(false);
  const [floating, setFloating] = useState([]);
  const rootRef = useRef(null);
  const lastSendRef = useRef(0);
  const sinceRef = useRef(new Date().toISOString());
  const seenIdsRef = useRef(new Set());
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  const spawnFloat = useCallback((emoji, id) => {
    const key = id || `${emoji}-${Date.now()}-${Math.random()}`;
    setFloating((prev) => [...prev, { key, emoji }]);
    window.setTimeout(() => {
      setFloating((prev) => prev.filter((f) => f.key !== key));
    }, reducedMotion ? 400 : FLOAT_MS);
  }, [reducedMotion]);

  const sendReaction = async (emoji) => {
    const now = Date.now();
    if (now - lastSendRef.current < SEND_COOLDOWN_MS) return;
    lastSendRef.current = now;
    spawnFloat(emoji, `local-${now}`);
    try {
      await liveWorkoutApi.sendReaction({ emoji, session_id: sessionId || undefined });
    } catch {
      /* silencieux */
    }
  };

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return undefined;
    }

    const poll = async () => {
      try {
        const { data } = await liveWorkoutApi.getReactions({ since: sinceRef.current });
        const list = Array.isArray(data) ? data : [];
        list.forEach((r) => {
          if (!r?.id || seenIdsRef.current.has(r.id)) return;
          seenIdsRef.current.add(r.id);
          spawnFloat(r.emoji, r.id);
          if (r.created_at && r.created_at > sinceRef.current) {
            sinceRef.current = r.created_at;
          }
        });
      } catch {
        /* ignore */
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, spawnFloat]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!enabled) return null;

  return (
    <div
      ref={rootRef}
      className="fixed z-40 right-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
      data-testid="live-workout-reactions"
    >
      <div className="pointer-events-none absolute bottom-14 right-0 flex h-28 w-16 flex-col items-center justify-end overflow-visible" aria-hidden>
        {floating.map((f) => (
          <span
            key={f.key}
            className={`absolute bottom-0 text-2xl ${
              reducedMotion ? 'opacity-80' : 'duo-reaction-float'
            }`}
            style={{ right: `${4 + Math.random() * 20}px` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      {open ? (
        <div
          className="flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated/90 p-1.5 shadow-lg backdrop-blur"
          role="dialog"
          aria-label={t('reactions.cheer')}
        >
          {REACTIONS.map(({ emoji, labelKey }) => (
            <button
              key={emoji}
              type="button"
              onClick={() => sendReaction(emoji)}
              aria-label={t(labelKey)}
              className="flex size-10 items-center justify-center rounded-full text-lg transition-colors hover:bg-active active:scale-95"
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('reactions.close')}
            className="flex size-9 items-center justify-center rounded-full border border-border bg-hover text-muted transition-colors hover:bg-active hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('reactions.open')}
          data-testid="live-reactions-fab"
          className="flex size-11 items-center justify-center rounded-full border border-border bg-surface-elevated/90 text-lg shadow-lg backdrop-blur transition-colors hover:bg-surface-subtle/95"
        >
          🔥
        </button>
      )}
    </div>
  );
}
