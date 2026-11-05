import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  EditAssetPage,
  NewAssetPage,
} from "@/routes/_auth/estates/$estateId/assets/-components/asset-editor-page";

const BACK_LINK = /^Back to/u;

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
  ["register", <NewAssetPage estateId="estate" key="register" />, ["Assets"]],
  [
    "edit",
    <EditAssetPage assetId="asset" estateId="estate" key="edit" />,
    ["Assets", "Asset"],
  ],
] as const)(
  "starts the %s asset form breadcrumbs at Assets, without back links",
  (_, page, links) => {
    renderWithProviders(page);
    const breadcrumbs = within(
      screen.getByRole("navigation", { name: "Breadcrumbs" })
    );
    expect(
      breadcrumbs.getAllByRole("link").map((link) => link.textContent)
    ).toEqual([...links]);
    expect(screen.queryByRole("link", { name: BACK_LINK })).toBeNull();
  }
);
