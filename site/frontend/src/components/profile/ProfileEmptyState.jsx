import { cn } from '../../lib/utils';

export function ProfileEmptyState({ icon: Icon, title, description, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center',
        className
      )}
    >
      {Icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
          <Icon size={24} className="text-zinc-500" />
        </div>
      ) : null}
      <p className="text-white font-medium font-['Outfit']">{title}</p>
      {description ? <p className="text-zinc-500 text-sm mt-2 max-w-xs">{description}</p> : null}
    </div>
  );
}
