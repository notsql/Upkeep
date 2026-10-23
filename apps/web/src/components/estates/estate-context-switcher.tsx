import { useAppAccess } from "@/lib/access";
import { EstateFeatureSwitcher } from "./estate-feature-switcher";

export function EstateContextSwitcher({
  estateId,
}: {
  estateId: string;
  estateName?: string;
}) {
  const access = useAppAccess();
  return (
    <EstateFeatureSwitcher
      estateId={estateId}
      estates={access.data?.estates ?? []}
      feature="management"
    />
  );
}
