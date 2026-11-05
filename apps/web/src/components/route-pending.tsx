import { Card } from "@proj/ui/components/card";
import { Skeleton } from "@proj/ui/components/skeleton";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";

// Pending screens render inside AppShell's outlet, so the sidebar and header
// stay mounted and only the content area swaps. The fade softens the swap.
const fade = "animate-in fade-in duration-300";

function HeaderSkeleton() {
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

/** Default route pending state: a page header and a few content rows. */
export function RoutePending() {
  return (
    <PageLayout className={fade}>
      <HeaderSkeleton />
      <LoadingState label="Loading page…" />
    </PageLayout>
  );
}

/** Home pending state, shaped like the dashboard: header, stat cards, lists. */
export function HomePending() {
  return (
    <PageLayout className={fade}>
      <HeaderSkeleton />
      <div aria-hidden="true" className="mb-8 grid gap-5 sm:grid-cols-3">
        {["a", "b", "c"].map((key) => (
          <Card className="gap-3 px-5" data-slot="stat-skeleton" key={key}>
            <Skeleton className="size-6" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </Card>
        ))}
      </div>
      <LoadingState label="Loading your workspace…" rows={2} />
    </PageLayout>
  );
}
