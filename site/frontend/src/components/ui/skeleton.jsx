import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-skeleton", className)}
      {...props} />
  );
}

export { Skeleton }
