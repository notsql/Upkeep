import type { components } from "@proj/api/schema";
import { EstateFeatureSwitcher } from "./estate-feature-switcher";
export function WorkOrderEstateSwitcher({
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
      feature="work-orders"
    />
  );
}
