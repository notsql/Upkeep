import { useCurrentEstate } from "@/components/app-navigation";
import { ResidentDashboard } from "@/routes/-components/resident-dashboard";

export function ResidentHome() {
  const { estateId } = useCurrentEstate();
  return <ResidentDashboard estateId={estateId} />;
}
