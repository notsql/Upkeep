import type { components } from "@proj/api/schema";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { OctagonAlert } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";
import { DeactivateEstateDialog } from "@/routes/_auth/estates/$estateId/-components/deactivate-estate-dialog";

/** Owner-only, and only while the estate is active. */
export function EstateDangerZone({
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
          <h2 className="flex items-center gap-2">
            <OctagonAlert
              aria-hidden="true"
              className="text-muted-foreground size-4"
            />
            Danger zone
          </h2>
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
