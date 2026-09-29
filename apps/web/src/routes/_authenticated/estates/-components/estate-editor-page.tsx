import type { components } from "@proj/api/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { estateError, useEstate, useEstateSession } from "@/lib/estates";
import { EstateForm } from "@/routes/_authenticated/estates/-components/estate-form";

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
  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <Link className="text-sm underline" to="/estates">
        Back to my estates
      </Link>
      <h1 className="mt-6 font-semibold text-2xl">
        {estateId ? "Edit estate" : "Create estate"}
      </h1>
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
          onSave={save.mutateAsync}
        />
      ) : null}
    </main>
  );
}
