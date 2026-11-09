import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
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
      confirmLabel={flagging ? "Turn on" : "Turn off"}
      description={
        flagging
          ? `${category.label} will show up on Due checks whenever it is due.`
          : `${category.label} will no longer show up on Due checks.`
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
          ? `Turn on regular checks for ${category.label}?`
          : `Turn off regular checks for ${category.label}?`
      }
    />
  );
}
