import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { LocationsSection } from "@/routes/_auth/estates/$estateId/-components/locations-section";

export function LocationsPage({ estateId }: { estateId: string }) {
  return (
    <PageLayout>
      <PageHeader
        description="Blocks, levels and common areas where assets and reports are placed."
        title="Locations"
      />
      <LocationsSection estateId={estateId} />
    </PageLayout>
  );
}
