import { ConfirmDialog } from "@/components/confirm-dialog";
import type { EstateAssetCategory } from "@/lib/asset-categories";

/** Confirms flagging or unflagging a category as failing silently (ID-83). */
export function SilentFailureDialog({
  category,
  error,
  pending,
  onConfirm,
  onCancel,
}: {
  category: EstateAssetCategory;
  error?: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const flagging = !category.failsSilently;
  return (
    <ConfirmDialog
      confirmLabel={flagging ? "Flag category" : "Stop flagging"}
      description={
        flagging
          ? `${category.label} assets will be included in regular spot checks, because they can fail without anyone noticing.`
          : `${category.label} assets will no longer be included in spot checks for silent failures.`
      }
      destructive={!flagging}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
      open
      pending={pending}
      pendingLabel="Saving…"
      title={
        flagging
          ? `Flag ${category.label} as failing silently?`
          : `Stop flagging ${category.label}?`
      }
    />
  );
}
