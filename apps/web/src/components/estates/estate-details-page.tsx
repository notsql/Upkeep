import { Button } from "@proj/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { DeactivateEstateDialog } from "@/components/estates/deactivate-estate-dialog";
import { api } from "@/lib/api";
import { estateError, useEstate, useEstateSession } from "@/lib/estates";

export function EstateDetailsPage({ estateId }: { estateId: string }) {
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
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <Link className="text-sm underline" to="/estates">
        Back to my estates
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
          <div className="mt-6 flex items-center justify-between gap-4">
            <h1 className="font-semibold text-2xl">{estate.data.name}</h1>
            <span className="border px-3 py-1 text-sm" role="status">
              {estate.data.deactivatedAt ? "Inactive" : "Active"}
            </span>
          </div>
          {estate.data.deactivatedAt ? (
            <p className="mt-4 border p-4 text-sm">
              This estate is inactive. Existing records remain available. New
              assets and reports are not accepted.
            </p>
          ) : null}
          <dl className="my-6 grid gap-4">
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
          <div className="flex items-center gap-4">
            <Link
              className="border px-4 py-2 text-sm"
              params={{ estateId }}
              to="/estates/$estateId/edit"
            >
              Edit estate
            </Link>
            {estate.data.deactivatedAt ? null : (
              <Button onClick={openConfirmation} variant="destructive">
                Deactivate estate
              </Button>
            )}
          </div>
          {confirming ? (
            <DeactivateEstateDialog
              code={estate.data.code}
              name={estate.data.name}
              onCancel={closeConfirmation}
              onConfirm={deactivate.mutateAsync}
            />
          ) : null}
        </>
      ) : null}
    </main>
  );
}
