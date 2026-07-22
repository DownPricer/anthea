import { FALLBACK_EXERCISE_IMAGE, handleExerciseImageError } from './exerciseMedia';

/**
 * GIF / média exercice avec lazy-load et respects prefers-reduced-motion.
 */
export function ExerciseMediaThumb({
  src,
  alt = '',
  className = 'w-16 h-16',
  rounded = 'rounded-lg',
  eager = false,
}) {
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!src) {
    return (
      <div
        className={`${className} ${rounded} bg-active flex items-center justify-center flex-shrink-0`}
        aria-hidden
      >
        <span className="text-subtle text-xs">—</span>
      </div>
    );
  }

  return (
    <div className={`${className} ${rounded} overflow-hidden bg-active flex-shrink-0`}>
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={`w-full h-full object-contain ${reducedMotion ? '' : ''}`}
        style={reducedMotion ? { animationPlayState: 'paused' } : undefined}
        onError={handleExerciseImageError}
      />
    </div>
  );
}

export function exerciseSecondaryLabel(exercise) {
  if (exercise?.secondary_label) return exercise.secondary_label;
  const bits = [];
  if (Array.isArray(exercise?.equipment) && exercise.equipment.length) {
    bits.push(exercise.equipment.slice(0, 2).join(', '));
  } else if (exercise?.category) {
    bits.push(exercise.category);
  }
  if (Array.isArray(exercise?.primary_muscles) && exercise.primary_muscles.length) {
    bits.push(exercise.primary_muscles.slice(0, 2).join(', '));
  }
  return bits.join(' · ') || null;
}

export { FALLBACK_EXERCISE_IMAGE };
