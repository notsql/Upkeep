import type { components } from "@proj/api/schema";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { FieldSet } from "@proj/ui/components/field";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { estateError, useEstate, useEstateSession } from "@/lib/estates";
import { DeactivateEstateDialog } from "@/routes/_auth/estates/$estateId/-components/deactivate-estate-dialog";

function EstateActions({
  estate,
  onDeactivate,
}: {
  estate: components["schemas"]["EstateResponse"];
  onDeactivate: () => void;
}) {
  const canManageCouncil =
    estate.canInviteMembers || estate.canManageInvitationPermissions;
  if (!(estate.owned || canManageCouncil)) {
    return null;
  }
  return (
    <FieldSet
      aria-label="Estate actions"
      className="page-actions min-w-0 flex-row gap-3"
    >
      {estate.owned ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{ estateId: estate.id }}
          to="/estates/$estateId/edit"
        >
          Edit estate
        </Link>
      ) : null}
      {canManageCouncil ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{ estateId: estate.id }}
          to="/estates/$estateId/council"
        >
          Council members
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

export function EstateDetailsPage({
  estateId,
  children,
}: {
  estateId: string;
  /** Sections rendered below the estate's details once it has loaded. */
  children?: ReactNode;
}) {
  const estate = useEstate(estateId);
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
      await queryClient.invalidateQueries({
        queryKey: ["estates", userId, "list"],
      });
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
        <p className="mt-6 text-destructive" role="alert">
          {estate.error.message}
        </p>
      ) : null}
      {estate.data ? (
        <>
          <PageHeader
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
            <p className="mt-4 border p-4 text-sm">
              This estate is inactive. Existing records remain available. New
              assets and reports are not accepted.
            </p>
          ) : null}
          <dl className="detail-grid my-6">
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
          {estate.data.owned ? null : (
            <p className="mb-3 text-muted-foreground text-sm">
              Shared with you. Only the owner can change this estate.
            </p>
          )}
          <EstateActions estate={estate.data} onDeactivate={openConfirmation} />
          {confirming ? (
            <DeactivateEstateDialog
              code={estate.data.code}
              name={estate.data.name}
              onCancel={closeConfirmation}
              onConfirm={deactivate.mutateAsync}
            />
          ) : null}
          {children}
          {estate.data.owned ? (
            <section
              aria-label="Estate assets"
              className="section-surface mt-8 space-y-4"
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
                {estate.data.deactivatedAt ? null : (
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
