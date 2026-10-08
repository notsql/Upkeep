import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  EditAssetPage,
  NewAssetPage,
} from "@/routes/_auth/estates/$estateId/assets/-components/asset-editor-page";
import {
  renderWithProviders,
  screen,
  within,
} from "../../../../../../test-utils";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/lib/estates", () => ({
  useEstate: () => ({ data: { id: "estate", name: "Maple Grove" } }),
}));
vi.mock("@/lib/assets", () => ({
  useAsset: () => ({ data: { id: "asset" } }),
  useCreateAsset: () => ({ mutateAsync: vi.fn() }),
  useUpdateAsset: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/-components/asset-form",
  () => ({ AssetForm: () => null })
);

it.each([
  ["register", <NewAssetPage estateId="estate" key="register" />],
  ["edit", <EditAssetPage assetId="asset" estateId="estate" key="edit" />],
] as const)(
  "names the estate while opening the %s asset form",
  async (_, page) => {
    renderWithProviders(page);
    const breadcrumbs = within(
      screen.getByRole("navigation", { name: "Breadcrumbs" })
    );
    await breadcrumbs.findByRole("link", { name: "Maple Grove" });
    expect(breadcrumbs.queryByRole("link", { name: "Estate" })).toBeNull();
  }
);
