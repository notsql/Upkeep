import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  useGenerateInspectionList,
  useInspectionList,
} from "@/lib/inspection-list";
import { useInspectionAccess } from "@/lib/inspections";

function addedMessage(added: number): string {
  if (added === 0) {
    return "No new checks are due.";
  }
  return added === 1 ? "Added 1 check." : `Added ${added} checks.`;
}
export function useInspectionsPage(estateId: string) {
  const list = useInspectionList(estateId);
  const generate = useGenerateInspectionList(estateId);
  const access = useInspectionAccess(estateId);
  const [error, setError] = useState<string>();
  const { mutateAsync } = generate;
  const run = useCallback(async () => {
    setError(undefined);
    try {
      const result = await mutateAsync();
      toast.success(addedMessage(result.added));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to generate the list. Please try again."
      );
    }
  }, [mutateAsync]);
  const { data, refetch } = list;
  const retry = useCallback(() => refetch(), [refetch]);
  return { access, data, error, generate, list, retry, run };
}
