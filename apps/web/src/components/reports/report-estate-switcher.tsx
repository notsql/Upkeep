import type { components } from "@proj/api/schema";
import { EstateFeatureSwitcher } from "@/components/estates/estate-feature-switcher";
export function ReportEstateSwitcher({
  estateId,
  estates,
}: {
  estateId: string;
  estates: components["schemas"]["EstateAccessResponse"][];
}) {
  return (
    <EstateFeatureSwitcher
      estateId={estateId}
      estates={estates}
      feature="reports"
    />
  );
}
