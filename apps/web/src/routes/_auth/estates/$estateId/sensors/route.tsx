import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SensorsLayout } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page";

/** Header and SubNav shared by the two device metric views. */
export const Route = createFileRoute("/_auth/estates/$estateId/sensors")({
  component: SensorsLayoutRoute,
});

function SensorsLayoutRoute() {
  const { estateId } = Route.useParams();
  return (
    <SensorsLayout estateId={estateId}>
      <Outlet />
    </SensorsLayout>
  );
}
