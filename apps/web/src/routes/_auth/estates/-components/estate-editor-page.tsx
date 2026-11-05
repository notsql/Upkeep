import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { useAppAccess } from "@/lib/access";
import { api } from "@/lib/api";
import {
  estateError,
  useEstate,
  useEstateSession,
  useSaveEstate,
} from "@/lib/estates";
import { EstateForm } from "@/routes/_auth/estates/-components/estate-form";
import { DeactivateEstateDialog } from "@/routes/_auth/estates/$estateId/-components/deactivate-estate-dialog";

function EstateCreationStatus({
  createdEstate,
  refreshAccess,
}: Pick<ReturnType<typeof useSaveEstate>, "createdEstate" | "refreshAccess">) {
  const { mutate, isError } = refreshAccess;
  const retry = useCallback(() => {
    if (createdEstate) {
      mutate(createdEstate);
    }
  }, [createdEstate, mutate]);
  if (!createdEstate) {
    return null;
  }
  if (isError) {
    return (
      <Alert className="mt-6" role="alert" variant="destructive">
        <AlertDescription>
          Estate created, but we could not refresh your access or open the
          estate. Try again to continue.
          <Button onClick={retry} variant="outline">
            Retry access
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <p aria-live="polite" className="mt-6" role="status">
      Estate created. Refreshing your access…
    </p>
  );
}

function EstateEditorHeader({ editing }: { editing: boolean }) {
  if (editing) {
    return (
      <PageHeader
        description="Keep estate identity and address details organised."
        title="Estate settings"
      />
    );
  }
  return (
    <PageHeader
      breadcrumbs={[
        { label: "Estates", to: "/estates" },
        { label: "Create estate" },
      ]}
      description="Keep estate identity and address details organised."
      title="Create estate"
    />
  );
}

/** Owner-only, and only while the estate is active. */
function EstateDangerZone({
  estate,
}: {
  estate?: components["schemas"]["EstateResponse"];
}) {
  const estateId = estate?.id ?? "";
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const deactivate = useMutation({
    mutationFn: async (confirmedCode: string) => {
      const { data, error, response } = await api.POST(
        "/estates/{id}/deactivate",
        { params: { path: { id: estateId } }, body: { code: confirmedCode } }
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
  if (!estate?.owned || estate.deactivatedAt) {
    return null;
  }
  return (
    <Card className="border-destructive/50 mt-6">
      <CardHeader>
        <CardTitle>
          <h2>Danger zone</h2>
        </CardTitle>
        <CardDescription>
          Deactivating keeps existing records but stops new assets and reports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={openConfirmation} variant="destructive">
          Deactivate estate
        </Button>
      </CardContent>
      {confirming ? (
        <DeactivateEstateDialog
          code={estate.code}
          name={estate.name}
          onCancel={closeConfirmation}
          onConfirm={deactivate.mutateAsync}
        />
      ) : null}
    </Card>
  );
}

export function EstateEditorPage({ estateId }: { estateId?: string }) {
  const estate = useEstate(estateId);
  const access = useAppAccess();
  const canEditDetails = Boolean(
    !estateId ||
      estate.data?.owned ||
      access.data?.estates.some(
        (assignment) =>
          assignment.estateId === estateId && assignment.canManageEstate
      )
  );
  const showPermissionError =
    estateId && estate.data && !canEditDetails && !access.isPending;
  const waitingForPermissions =
    estate.data && !canEditDetails && access.isPending;
  const navigate = useNavigate();
  const save = useSaveEstate(estateId, async (data) => {
    toast.success(estateId ? "Estate details updated." : "Estate created.");
    await navigate({
      to: "/estates/$estateId",
      params: { estateId: data.id },
    });
  });
  const cancel = useCallback(() => {
    navigate(
      estateId
        ? { to: "/estates/$estateId", params: { estateId } }
        : { to: "/estates" }
    );
  }, [navigate, estateId]);
  return (
    <PageLayout className="max-w-3xl">
      <EstateEditorHeader editing={Boolean(estateId)} />
      {estateId && (estate.isPending || waitingForPermissions) ? (
        <div className="mt-6">
          <LoadingState label="Loading estate…" rows={2} />
        </div>
      ) : null}
      {estateId && estate.error ? (
        <Alert className="mt-6" variant="destructive">
          <AlertDescription>{estate.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {showPermissionError ? (
        <Alert className="mt-6" variant="destructive">
          <AlertDescription>
            {access.error?.message ??
              "Only the owner or an assigned Manager can edit estate details."}
          </AlertDescription>
        </Alert>
      ) : null}
      {estate.data?.deactivatedAt ? (
        <p className="text-muted-foreground mt-4">
          This estate is inactive. Editing its details will not reactivate it.
        </p>
      ) : null}
      <EstateCreationStatus
        createdEstate={save.createdEstate}
        refreshAccess={save.refreshAccess}
      />
      {!save.createdEstate && (!estateId || (estate.data && canEditDetails)) ? (
        <EstateForm
          initialValues={estateId ? estate.data : undefined}
          key={estate.data?.id ?? "new"}
          onCancel={cancel}
          onSave={save.mutateAsync}
        />
      ) : null}
      {save.createdEstate ? null : <EstateDangerZone estate={estate.data} />}
    </PageLayout>
  );
}
