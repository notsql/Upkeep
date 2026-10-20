import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { useAppAccess } from "@/lib/access";
import { useEstate, useSaveEstate } from "@/lib/estates";
import { EstateForm } from "@/routes/_auth/estates/-components/estate-form";

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
    <main className="page-layout max-w-3xl">
      <Link className="text-sm underline" to="/estates">
        Back to estates
      </Link>
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          { label: estateId ? "Edit estate" : "Create estate" },
        ]}
        description="Keep estate identity and address details organised."
        title={estateId ? "Edit estate" : "Create estate"}
      />
      {estateId && (estate.isPending || waitingForPermissions) ? (
        <p aria-live="polite" className="mt-6">
          Loading estate…
        </p>
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
        <p className="mt-4 text-muted-foreground">
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
    </main>
  );
}
