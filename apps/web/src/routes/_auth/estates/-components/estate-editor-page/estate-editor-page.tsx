import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { PageLayout } from "@/components/page/page-layout";
import { LoadingState } from "@/components/states/loading-state";
import { useAppAccess } from "@/lib/access";
import { useEstate, useSaveEstate } from "@/lib/estates";
import { EstateCreationStatus } from "@/routes/_auth/estates/-components/estate-editor-page/estate-creation-status";
import { EstateDangerZone } from "@/routes/_auth/estates/-components/estate-editor-page/estate-danger-zone";
import { EstateEditorHeader } from "@/routes/_auth/estates/-components/estate-editor-page/estate-editor-header";
import { EstateForm } from "@/routes/_auth/estates/-components/estate-editor-page/estate-form/estate-form";

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
