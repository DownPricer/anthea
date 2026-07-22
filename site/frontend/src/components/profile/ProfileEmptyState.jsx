import { cn } from '../../lib/utils';

export function ProfileEmptyState({ icon: Icon, title, description, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-hover px-6 py-14 text-center',
        className
      )}
    >
      {Icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-hover">
          <Icon size={24} className="text-subtle" />
        </div>
      ) : null}
      <p className="text-foreground font-medium font-['Outfit']">{title}</p>
      {description ? <p className="text-subtle text-sm mt-2 max-w-xs">{description}</p> : null}
    </div>
  );
}
