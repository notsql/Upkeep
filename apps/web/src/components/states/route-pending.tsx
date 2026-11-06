import { PageLayout } from "@/components/page/page-layout";
import { HeaderSkeleton } from "@/components/states/header-skeleton";
import { LoadingState } from "@/components/states/loading-state";

// Pending screens render inside AppShell's outlet, so the sidebar and header
// stay mounted and only the content area swaps. The fade softens the swap.
export const fade = "animate-in fade-in duration-300";

/** Default route pending state: a page header and a few content rows. */
export function RoutePending() {
  return (
    <PageLayout className={fade}>
      <HeaderSkeleton />
      <LoadingState label="Loading page…" />
    </PageLayout>
  );
}
