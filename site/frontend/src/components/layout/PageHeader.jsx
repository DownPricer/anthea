import { cn } from '@/lib/utils';

/**
 * En-tête de page partagé — titre en haut à gauche, sous-titre discret.
 */
export function PageHeader({
  title,
  subtitle,
  leading = null,
  actions = null,
  className,
  subtitleClassName,
  titleTestId,
}) {
  return (
    <header
      className={cn('mb-5 md:mb-6', className)}
      data-testid="page-header"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 flex items-start gap-3">
          {leading}
          <div className="min-w-0">
            <h1
              className="text-xl md:text-2xl font-bold text-foreground font-['Outfit'] leading-tight"
              data-testid={titleTestId}
            >
              {title}
            </h1>
            {subtitle ? (
              <p
                className={cn(
                  'text-subtle text-sm mt-0.5 leading-snug',
                  subtitleClassName
                )}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="shrink-0 flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
