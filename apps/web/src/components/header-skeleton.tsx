import { Skeleton } from "@proj/ui/components/skeleton";

export function HeaderSkeleton() {
  return (
    <div aria-hidden="true" className="mb-6 flex items-center gap-3">
      <Skeleton className="size-10 rounded-lg" />
      <div className="grid flex-1 gap-2">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
