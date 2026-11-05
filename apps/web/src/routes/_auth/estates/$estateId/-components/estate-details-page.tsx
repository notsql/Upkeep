import { Alert, AlertDescription } from "@proj/ui/components/alert";
import type { ReactNode } from "react";
import { DetailCard } from "@/components/detail-card";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { useAppAccess } from "@/lib/access";
import { formatMcst, useEstate } from "@/lib/estates";
export function EstateDetailsPage({
  estateId,
  children,
}: {
  estateId: string;
  /** Sections rendered below the estate's details once it has loaded. */
  children?: ReactNode;
}) {
  const estate = useEstate(estateId);
  const access = useAppAccess();
  const canEditDetails = Boolean(
    estate.data?.owned ||
      access.data?.estates.some(
        (assignment) =>
          assignment.estateId === estateId && assignment.canManageEstate
      )
  );
  return (
    <PageLayout>
      {estate.isPending ? (
        <p aria-live="polite" className="mt-6">
          Loading estate…
        </p>
      ) : null}
      {estate.error ? (
        <Alert className="mt-6" variant="destructive">
          <AlertDescription>{estate.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {estate.data ? (
        <>
          <PageHeader
            description={estate.data.description || undefined}
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
          <DetailCard className="my-4">
            <div>
              <dt className="font-medium">MCST number</dt>
              <dd>{formatMcst(estate.data.code)}</dd>
            </div>
            <div>
              <dt className="font-medium">Address</dt>
              <dd>{estate.data.address}</dd>
            </div>
            <div>
              <dt className="font-medium">Postal code</dt>
              <dd>{estate.data.postalCode}</dd>
            </div>
            <div>
              <dt className="font-medium">Description</dt>
              <dd className="whitespace-pre-wrap">
                {estate.data.description || "No description provided."}
              </dd>
            </div>
          </DetailCard>
          {canEditDetails ? null : (
            <p className="text-muted-foreground mb-3 text-sm">
              Shared with you. Only the owner or an assigned Manager can edit
              estate details.
            </p>
          )}
          {children}
        </>
      ) : null}
    </PageLayout>
  );
}
