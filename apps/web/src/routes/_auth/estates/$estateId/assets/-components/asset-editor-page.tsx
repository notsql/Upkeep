import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import {
  type AssetInput,
  useAsset,
  useCreateAsset,
  useUpdateAsset,
} from "@/lib/assets";
import { AssetForm } from "@/routes/_auth/estates/$estateId/assets/-components/asset-form";

export function NewAssetPage({ estateId }: { estateId: string }) {
  const create = useCreateAsset(estateId);
  const navigate = useNavigate();
  const save = useCallback(
    async (values: AssetInput) => {
      const asset = await create.mutateAsync(values);
      toast.success(`Asset ${asset.reference} registered.`);
      await navigate({
        to: "/estates/$estateId/assets/$assetId",
        params: { estateId, assetId: asset.id },
      });
    },
    [create.mutateAsync, navigate, estateId]
  );
  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <Link
        className="text-sm underline"
        params={{ estateId }}
        to="/estates/$estateId"
      >
        Back to estate
      </Link>
      <h1 className="mt-6 font-semibold text-2xl">Register asset</h1>
      <AssetForm estateId={estateId} onSave={save} />
    </main>
  );
}

export function EditAssetPage({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const asset = useAsset(estateId, assetId);
  const update = useUpdateAsset(estateId, assetId);
  const navigate = useNavigate();
  const save = useCallback(
    async (values: AssetInput) => {
      await update.mutateAsync(values);
      toast.success("Asset details updated.");
      await navigate({
        to: "/estates/$estateId/assets/$assetId",
        params: { estateId, assetId },
      });
    },
    [update.mutateAsync, navigate, estateId, assetId]
  );
  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <Link
        className="text-sm underline"
        params={{ estateId, assetId }}
        to="/estates/$estateId/assets/$assetId"
      >
        Back to asset
      </Link>
      <h1 className="mt-6 font-semibold text-2xl">Edit asset</h1>
      {asset.isPending ? (
        <p aria-live="polite" className="mt-6">
          Loading asset…
        </p>
      ) : null}
      {asset.error ? (
        <p className="mt-6 text-destructive" role="alert">
          {asset.error.message}
        </p>
      ) : null}
      {asset.data?.deactivatedAt ? (
        <p className="mt-6 border p-4 text-sm" role="status">
          This asset is deactivated and can no longer be edited.
        </p>
      ) : null}
      {asset.data && !asset.data.deactivatedAt ? (
        <AssetForm
          estateId={estateId}
          initialValues={asset.data}
          key={asset.data.id}
          onSave={save}
        />
      ) : null}
    </main>
  );
}
