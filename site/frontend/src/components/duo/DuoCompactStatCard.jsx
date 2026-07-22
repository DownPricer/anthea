import { cn } from '@/lib/utils';

/** Petite carte stats homogène : icône + valeur + libellé. */
export function DuoCompactStatCard({
  icon: Icon,
  value,
  label,
  loading = false,
  className,
  valueClassName,
  testId,
}) {
  const display =
    loading || value === null || value === undefined || value === ''
      ? '—'
      : value;

  return (
    <div
      className={cn(
        'card p-3 min-w-0 overflow-hidden text-center',
        className
      )}
      data-testid={testId}
    >
      {Icon ? (
        <Icon
          className="mx-auto mb-1 text-[var(--theme-primary)]"
          size={16}
          aria-hidden
        />
      ) : null}
      <p
        className={cn(
          'text-lg font-bold text-foreground tabular-nums leading-tight truncate',
          valueClassName
        )}
      >
        {display}
      </p>
      <p className="text-subtle text-[10px] uppercase tracking-wide mt-0.5 line-clamp-2 break-words">
        {label}
      </p>
    </div>
  );
}
