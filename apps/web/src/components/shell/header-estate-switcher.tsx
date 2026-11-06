import { useCurrentEstate } from "@/components/shell/app-navigation";
import { EstateFeatureSwitcher } from "@/components/shell/estate-feature-switcher";
import type { EstateFeature } from "@/lib/estate-destinations";

const ESTATE_FEATURES = new Set<EstateFeature>([
  "reports",
  "work-orders",
  "documents",
  "readings",
]);

function pathFeature(pathname: string): EstateFeature {
  if (pathname.startsWith("/reports/new")) {
    return "report-creation";
  }
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return "resident";
  }
  const section = pathname.split("/")[3] as EstateFeature;
  return ESTATE_FEATURES.has(section) ? section : "management";
}

export function HeaderEstateSwitcher() {
  const { access, pathname, estateId } = useCurrentEstate();
  const estates = access.data?.estates ?? [];
  return (
    <EstateFeatureSwitcher
      estateId={estateId}
      estates={
        access.data?.canEnterWorkspace
          ? estates
          : estates.filter((estate) => estate.role === "RESIDENT")
      }
      feature={pathFeature(pathname)}
    />
  );
}
