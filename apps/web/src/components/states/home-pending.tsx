import { Card } from "@proj/ui/components/card";
import { Skeleton } from "@proj/ui/components/skeleton";
import { PageLayout } from "@/components/page/page-layout";
import { HeaderSkeleton } from "@/components/states/header-skeleton";
import { LoadingState } from "@/components/states/loading-state";
import { fade } from "@/components/states/route-pending";

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
