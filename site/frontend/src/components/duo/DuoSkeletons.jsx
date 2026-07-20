import { Skeleton } from '../ui/skeleton';

export function DuoHeaderSkeleton() {
  return (
    <div className="flex items-center gap-4 mb-6" data-testid="duo-header-skeleton">
      <div className="flex -space-x-3">
        <Skeleton className="w-12 h-12 rounded-full bg-white/10" />
        <Skeleton className="w-12 h-12 rounded-full bg-white/10" />
      </div>
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-40 bg-white/10" />
        <Skeleton className="h-3 w-24 bg-white/10" />
      </div>
    </div>
  );
}

export function DuoStatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="duo-stats-skeleton">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-4 space-y-2">
          <Skeleton className="h-4 w-4 mx-auto rounded bg-white/10" />
          <Skeleton className="h-7 w-12 mx-auto bg-white/10" />
          <Skeleton className="h-2 w-16 mx-auto bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export function DuoChallengeSkeleton() {
  return (
    <div className="card p-4 space-y-3" data-testid="duo-challenge-skeleton">
      <Skeleton className="h-4 w-32 bg-white/10" />
      <Skeleton className="h-3 w-48 bg-white/10" />
      <Skeleton className="h-2 w-full rounded-full bg-white/10" />
    </div>
  );
}

export function DuoBadgesSkeleton() {
  return (
    <div className="flex flex-wrap justify-center gap-2" data-testid="duo-badges-skeleton">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="w-[4.75rem] h-24 rounded-2xl bg-white/10" />
      ))}
    </div>
  );
}

export function DuoActivitySkeleton() {
  return (
    <div className="space-y-3" data-testid="duo-activity-skeleton">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3">
          <div className="flex gap-3">
            <Skeleton className="w-10 h-10 rounded-full bg-white/10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2 bg-white/10" />
              <Skeleton className="h-3 w-1/3 bg-white/10" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded-xl bg-white/10" />
        </div>
      ))}
    </div>
  );
}
