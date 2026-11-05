import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Settings } from "lucide-react";
import { LifecycleStatusBadge } from "@/components/badges/lifecycle-status-badge";
import { PageHeader } from "@/components/page/page-header";
import { PageLayout } from "@/components/page/page-layout";
import { LoadingState } from "@/components/states/loading-state";
import { useAppAccess } from "@/lib/access";
import { formatMcst, useEstate } from "@/lib/estates";
import {
  dashboardAccess,
  EstateDashboard,
} from "@/routes/_auth/estates/$estateId/-components/estate-details-page/estate-dashboard";
export function EstateDetailsPage({ estateId }: { estateId: string }) {
  const estate = useEstate(estateId);
  const access = useAppAccess();
  const permission = access.data?.estates.find(
    (assignment) => assignment.estateId === estateId
  );
  const canEditDetails = Boolean(
    estate.data?.owned || permission?.canManageEstate
  );
  return (
    <PageLayout>
      {estate.isPending ? (
        <LoadingState label="Loading estate…" rows={2} />
      ) : null}
      {estate.error ? (
        <Alert className="mt-6" variant="destructive">
          <AlertDescription>{estate.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {estate.data ? (
        <>
          <PageHeader
            actions={
              canEditDetails ? (
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  params={{ estateId }}
                  to="/estates/$estateId/edit"
                >
                  <Settings aria-hidden="true" />
                  Estate settings
                </Link>
              ) : undefined
            }
            description={estate.data.description || undefined}
            icon={LayoutDashboard}
            status={
              <LifecycleStatusBadge
                inactive={Boolean(estate.data.deactivatedAt)}
                inactiveLabel="Inactive"
              />
            }
            title={estate.data.name}
          />
          {estate.data.deactivatedAt ? (
            <Alert className="mt-4" role="note">
              <AlertDescription>
                This estate is inactive. Existing records remain available. New
                assets and reports are not accepted.
              </AlertDescription>
            </Alert>
          ) : null}
          <dl className="text-muted-foreground -mt-2 mb-6 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <dt className="sr-only">MCST number</dt>
              <dd>{formatMcst(estate.data.code)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="sr-only">Address</dt>
              <dd>{estate.data.address}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Postal code</dt>
              <dd>{estate.data.postalCode}</dd>
            </div>
          </dl>
          {canEditDetails ? null : (
            <p className="text-muted-foreground mb-4 text-sm">
              Shared with you. Only the owner or an assigned Manager can edit
              estate details.
            </p>
          )}
          <EstateDashboard
            access={dashboardAccess(permission, estate.data.owned)}
            estateId={estateId}
          />
        </>
      ) : null}
    </PageLayout>
  );
}
