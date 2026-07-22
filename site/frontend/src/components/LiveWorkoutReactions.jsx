import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { liveWorkoutApi } from '../lib/api';

const REACTIONS = [
  { emoji: '🔥', labelKey: 'reactions.fire' },
  { emoji: '❤️', labelKey: 'reactions.heart' },
  { emoji: '👏', labelKey: 'reactions.clap' },
  { emoji: '💪', labelKey: 'reactions.flex' },
];

const SEND_COOLDOWN_MS = 300;
const POLL_MS = 2000;
const FLOAT_MS = 1600;

/**
 * Réactions éphémères duo en direct (remplace le chat).
 */
export function LiveWorkoutReactions({ sessionId, enabled = true }) {
  const { t } = useTranslation('player');
  const [floating, setFloating] = useState([]);
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
      /* silencieux — réaction locale déjà affichée */
    }
  };

  useEffect(() => {
    if (!enabled) return undefined;

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

  if (!enabled) return null;

  return (
    <div className="relative space-y-2" data-testid="live-workout-reactions">
      <p className="text-zinc-400 text-xs text-center sm:text-left">
        {t('reactions.cheer')}
      </p>
      <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
        {REACTIONS.map(({ emoji, labelKey }) => (
          <button
            key={emoji}
            type="button"
            onClick={() => sendReaction(emoji)}
            aria-label={t(labelKey)}
            className="h-11 w-11 sm:h-10 sm:w-10 rounded-xl bg-white/5 border border-white/10 text-xl hover:bg-white/10 active:scale-95 transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-12 h-24 overflow-hidden"
        aria-hidden
      >
        {floating.map((f) => (
          <span
            key={f.key}
            className={`absolute left-1/2 text-2xl ${
              reducedMotion ? 'opacity-80' : 'duo-reaction-float'
            }`}
            style={{ marginLeft: `${(Math.random() * 40) - 20}px` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}
