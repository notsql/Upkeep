import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import {
  type AssetInput,
  useAsset,
  useCreateAsset,
  useUpdateAsset,
} from "@/lib/assets";
import { useEstate } from "@/lib/estates";
import { AssetForm } from "@/routes/_auth/estates/$estateId/assets/-components/asset-form";

export function NewAssetPage({ estateId }: { estateId: string }) {
  const estate = useEstate(estateId);
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
  const cancel = useCallback(() => {
    navigate({ to: "/estates/$estateId/assets", params: { estateId } });
  }, [navigate, estateId]);
  return (
    <main className="page-layout max-w-3xl">
      <Link
        className="text-sm underline"
        params={{ estateId }}
        to="/estates/$estateId"
      >
        Back to estate
      </Link>
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: estate.data?.name ?? "Estate",
            to: "/estates/$estateId",
            params: { estateId },
          },
          {
            label: "Assets",
            to: "/estates/$estateId/assets",
            params: { estateId },
          },
          { label: "Register asset" },
        ]}
        description="Add equipment and its location to this estate."
        title="Register asset"
      />
      <AssetForm estateId={estateId} onCancel={cancel} onSave={save} />
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
  const estate = useEstate(estateId);
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
  const cancel = useCallback(() => {
    navigate({
      to: "/estates/$estateId/assets/$assetId",
      params: { estateId, assetId },
    });
  }, [navigate, estateId, assetId]);
  return (
    <main className="page-layout max-w-3xl">
      <Link
        className="text-sm underline"
        params={{ estateId, assetId }}
        to="/estates/$estateId/assets/$assetId"
      >
        Back to asset
      </Link>
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: estate.data?.name ?? "Estate",
            to: "/estates/$estateId",
            params: { estateId },
          },
          {
            label: "Assets",
            to: "/estates/$estateId/assets",
            params: { estateId },
          },
          { label: "Edit asset" },
        ]}
        description="Update equipment details without changing its reference."
        title="Edit asset"
      />
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
          onCancel={cancel}
          onSave={save}
        />
      ) : null}
    </main>
  );
}
