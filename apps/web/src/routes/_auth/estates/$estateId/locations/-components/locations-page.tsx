import { PageLayout } from "@/components/page-layout";
import { LocationsSection } from "@/routes/_auth/estates/$estateId/-components/locations-section";

export function LocationsPage({ estateId }: { estateId: string }) {
  return (
    <PageLayout>
      <LocationsSection estateId={estateId} />
    </PageLayout>
  );
}
