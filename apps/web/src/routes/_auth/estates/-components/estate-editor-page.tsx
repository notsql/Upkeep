import type { components } from "@proj/api/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { estateError, useEstate, useEstateSession } from "@/lib/estates";
import { EstateForm } from "@/routes/_auth/estates/-components/estate-form";

export function EstateEditorPage({ estateId }: { estateId?: string }) {
  const estate = useEstate(estateId);
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const save = useMutation({
    mutationFn: async (body: components["schemas"]["EstateRequest"]) => {
      const { data, error, response } = estateId
        ? await api.PATCH("/estates/{id}", {
            params: { path: { id: estateId } },
            body,
          })
        : await api.POST("/estates", { body });
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(["estates", userId, "details", data.id], data);
      await queryClient.invalidateQueries({
        queryKey: ["estates", userId, "list"],
      });
      toast.success(estateId ? "Estate details updated." : "Estate created.");
      await navigate({
        to: "/estates/$estateId",
        params: { estateId: data.id },
      });
    },
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
      {estateId && estate.isPending ? (
        <p aria-live="polite" className="mt-6">
          Loading estate…
        </p>
      ) : null}
      {estateId && estate.error ? (
        <p className="mt-6 text-destructive" role="alert">
          {estate.error.message}
        </p>
      ) : null}
      {estate.data?.deactivatedAt ? (
        <p className="mt-4 text-muted-foreground">
          This estate is inactive. Editing its details will not reactivate it.
        </p>
      ) : null}
      {!estateId || estate.data ? (
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
