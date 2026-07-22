import { useState } from 'react';
import {
  FALLBACK_EXERCISE_IMAGE,
  handleExerciseImageError,
  resolveExerciseMediaUrl,
} from '../../lib/exerciseMedia';

/**
 * GIF / média exercice avec lazy-load, états loading/loaded/error,
 * referrerPolicy no-referrer, prefers-reduced-motion.
 */
export function ExerciseMediaThumb({
  src,
  alt = '',
  className = 'h-16 w-16',
  rounded = 'rounded-lg',
  eager = false,
}) {
  const [status, setStatus] = useState('loading');
  const resolved = resolveExerciseMediaUrl(src);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!resolved) {
    return (
      <div
        className={`${className} ${rounded} bg-active flex items-center justify-center flex-shrink-0 shrink-0`}
        aria-hidden
      >
        <span className="text-subtle text-xs">—</span>
      </div>
    );
  }

  return (
    <div
      className={`${className} ${rounded} overflow-hidden bg-active flex-shrink-0 shrink-0 relative`}
    >
      {status === 'loading' ? (
        <div className="absolute inset-0 animate-pulse bg-hover" aria-hidden />
      ) : null}
      <img
        src={resolved}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        className={`h-full w-full object-contain ${status === 'error' ? 'opacity-70' : ''}`}
        style={reducedMotion ? { animationPlayState: 'paused' } : undefined}
        onLoad={() => setStatus('loaded')}
        onError={(event) => {
          if (status === 'error') return;
          setStatus('error');
          handleExerciseImageError(event);
        }}
      />
    </div>
  );
}

export function exerciseSecondaryLabel(exercise) {
  if (exercise?.secondary_label) return exercise.secondary_label;
  const bits = [];
  const equip =
    (Array.isArray(exercise?.equipment_labels) && exercise.equipment_labels.length
      ? exercise.equipment_labels
      : null) ||
    (Array.isArray(exercise?.equipment) ? exercise.equipment : null);
  if (equip && equip.length) {
    bits.push(equip.slice(0, 2).join(', '));
  } else if (exercise?.category) {
    bits.push(exercise.category);
  }
  const muscles =
    (Array.isArray(exercise?.muscle_labels) && exercise.muscle_labels.length
      ? exercise.muscle_labels
      : null) ||
    (Array.isArray(exercise?.primary_muscles) ? exercise.primary_muscles : null);
  if (muscles && muscles.length) {
    bits.push(muscles.slice(0, 2).join(', '));
  }
  return bits.join(' · ') || null;
}

export { FALLBACK_EXERCISE_IMAGE, resolveExerciseMediaUrl };
