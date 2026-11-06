import { useCurrentEstate } from "@/components/shell/app-navigation";
import { ResidentDashboard } from "@/routes/-components/home-page/resident-home/resident-dashboard";

export function ResidentHome() {
  const { estateId } = useCurrentEstate();
  return <ResidentDashboard estateId={estateId} />;
}
