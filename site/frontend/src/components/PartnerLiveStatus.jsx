import { Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PartnerLiveStatus({ liveSession, compact = false, className }) {
  if (!liveSession?.active) return null;

  const name = liveSession.display_name || liveSession.username || 'Partenaire';

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium',
          'bg-green-500/15 text-green-400 border border-green-500/25',
          className
        )}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
        </span>
        En direct
      </span>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl bg-green-500/8 border border-green-500/20',
        className
      )}
    >
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500/15">
        <Radio size={16} className="text-green-400" />
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-green-400 text-xs font-medium uppercase tracking-wide">En direct</p>
        <p className="text-white text-sm font-medium truncate">
          {name} est en séance
        </p>
        {liveSession.workout_title && (
          <p className="text-zinc-500 text-xs truncate">{liveSession.workout_title}</p>
        )}
      </div>
      {liveSession.elapsed_seconds != null && (
        <p className="text-zinc-400 text-xs font-mono tabular-nums shrink-0">
          {formatElapsed(liveSession.elapsed_seconds)}
        </p>
      )}
    </div>
  );
}

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
