import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { FieldSet } from "@proj/ui/components/field";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";
import { PageHeader } from "@/components/page-header";
import { useAppAccess } from "@/lib/access";
import { api } from "@/lib/api";
import { dashboardQueryKey } from "@/lib/dashboard";
import { estateError, useEstate, useEstateSession } from "@/lib/estates";
import { DeactivateEstateDialog } from "@/routes/_auth/estates/$estateId/-components/deactivate-estate-dialog";

function EstateActions({
  estate,
  canEditDetails,
  onDeactivate,
  canViewSensors,
  canViewWorkOrders,
  canViewRoles,
  canViewInvitations,
}: {
  estate: components["schemas"]["EstateResponse"];
  canEditDetails: boolean;
  onDeactivate: () => void;
  canViewSensors: boolean;
  canViewWorkOrders: boolean;
  canViewRoles: boolean;
  canViewInvitations: boolean;
}) {
  const canManageCouncil =
    canViewInvitations ||
    estate.canInviteMembers ||
    estate.canManageInvitationPermissions;
  if (
    !(
      estate.owned ||
      canEditDetails ||
      canManageCouncil ||
      canViewSensors ||
      canViewRoles ||
      canViewWorkOrders
    )
  ) {
    return null;
  }
  return (
    <FieldSet
      aria-label="Estate actions"
      className="page-actions min-w-0 flex-row gap-3"
    >
      {canViewWorkOrders ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{ estateId: estate.id }}
          to="/estates/$estateId/work-orders"
        >
          View work orders
        </Link>
      ) : null}
      {canViewRoles ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{ estateId: estate.id }}
          to="/estates/$estateId/roles"
        >
          Roles
        </Link>
      ) : null}
      {estate.owned || estate.canManageInvitationPermissions ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{ estateId: estate.id }}
          to="/estates/$estateId/devices"
        >
          Devices
        </Link>
      ) : null}
      {canViewSensors ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{ estateId: estate.id }}
          to="/estates/$estateId/sensors"
        >
          Device monitoring
        </Link>
      ) : null}
      {canEditDetails ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{ estateId: estate.id }}
          to="/estates/$estateId/edit"
        >
          Edit estate
        </Link>
      ) : null}
      {estate.owned ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{ estateId: estate.id }}
          to="/estates/$estateId/failure-risk"
        >
          Failure risk
        </Link>
      ) : null}
      {canManageCouncil ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{ estateId: estate.id }}
          to="/estates/$estateId/council"
        >
          Estate members
        </Link>
      ) : null}
      {estate.owned && !estate.deactivatedAt ? (
        <Button onClick={onDeactivate} variant="destructive">
          Deactivate estate
        </Button>
      ) : null}
    </FieldSet>
  );
}

function canViewEstateSensors(
  owned: boolean | undefined,
  permission: components["schemas"]["EstateAccessResponse"] | undefined,
  platformAdmin: boolean | undefined
): boolean {
  return Boolean(
    owned ||
      (permission?.canViewManagement &&
        (permission.role === "MANAGER" ||
          permission.role === "COUNCIL" ||
          (permission.role === "MEMBER" && platformAdmin)))
  );
}

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
  const permission = access.data?.estates?.find(
    (item) => item.estateId === estateId
  );
  const canViewSensors = canViewEstateSensors(
    estate.data?.owned,
    permission,
    access.data?.canAccessPlatformAdmin
  );
  const canEditDetails = Boolean(
    estate.data?.owned ||
      access.data?.estates.some(
        (assignment) =>
          assignment.estateId === estateId && assignment.canManageEstate
      )
  );
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const deactivate = useMutation({
    mutationFn: async (code: string) => {
      const { data, error, response } = await api.POST(
        "/estates/{id}/deactivate",
        { params: { path: { id: estateId } }, body: { code } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(["estates", userId, "details", estateId], data);
      setConfirming(false);
      toast.success(
        "Estate deactivated. Existing records have been preserved."
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["estates", userId, "list"],
        }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKey(userId) }),
      ]);
    },
  });
  const openConfirmation = useCallback(() => setConfirming(true), []);
  const closeConfirmation = useCallback(() => setConfirming(false), []);
  return (
    <main className="page-layout">
      <Link className="text-sm underline" to="/estates">
        Back to estates
      </Link>
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
            actions={
              <EstateActions
                canEditDetails={canEditDetails}
                canViewInvitations={
                  permission?.canViewEstateInvitations === true
                }
                canViewRoles={permission?.canViewEstateRoles === true}
                canViewSensors={canViewSensors}
                canViewWorkOrders={
                  !access.isError && !!permission?.canViewWorkOrders
                }
                estate={estate.data}
                onDeactivate={openConfirmation}
              />
            }
            breadcrumbs={[
              { label: "Estates", to: "/estates" },
              { label: estate.data.name },
            ]}
            description="Estate overview and management"
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
          <dl className="detail-grid my-4">
            <div>
              <dt className="font-medium">Estate code</dt>
              <dd>{estate.data.code}</dd>
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
          </dl>
          {canEditDetails ? null : (
            <p className="mb-3 text-muted-foreground text-sm">
              Shared with you. Only the owner or an assigned Manager can edit
              estate details.
            </p>
          )}
          {confirming ? (
            <DeactivateEstateDialog
              code={estate.data.code}
              name={estate.data.name}
              onCancel={closeConfirmation}
              onConfirm={deactivate.mutateAsync}
            />
          ) : null}
          {children}
          {estate.data.owned || permission?.canViewInspectionResults ? (
            <section
              aria-label="Estate assets"
              className="section-surface mt-6 space-y-3"
            >
              <h2 className="font-semibold text-xl">Assets</h2>
              <div className="flex flex-wrap gap-4">
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  params={{ estateId }}
                  to="/estates/$estateId/assets"
                >
                  View assets
                </Link>
                {!estate.data.owned || estate.data.deactivatedAt ? null : (
                  <Link
                    className={buttonVariants({ variant: "outline" })}
                    params={{ estateId }}
                    to="/estates/$estateId/assets/new"
                  >
                    Register asset
                  </Link>
                )}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
