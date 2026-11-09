import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { AssetViewsNav } from "@/routes/_auth/estates/$estateId/assets/-components/asset-views-nav";

const ESTATE = "3f6c1f9e-8a2b-4c5d-9e0f-1a2b3c4d5e6f";
const access = vi.hoisted(() => ({
  pending: false,
  assetPages: true,
  allDevices: true,
  allReadings: true,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: { estateId?: string };
  }) => (
    <a href={to.replace("$estateId", params?.estateId ?? "")}>{children}</a>
  ),
  useRouterState: () => "/",
}));
vi.mock("@/lib/devices", () => ({ useAssetViewsAccess: () => access }));

beforeEach(() => {
  Object.assign(access, {
    pending: false,
    assetPages: true,
    allDevices: true,
    allReadings: true,
  });
});

it("tabs between the asset views for any asset-page viewer", () => {
  renderWithProviders(<AssetViewsNav estateId={ESTATE} />);
  const nav = screen.getByRole("navigation", { name: "Asset views" });
  within(nav).getByRole("link", { name: "By location" });
  within(nav).getByRole("link", { name: "All devices" });
});

it("links All readings for owners and Managers", () => {
  renderWithProviders(<AssetViewsNav estateId={ESTATE} />);
  expect(
    screen.getByRole("link", { name: "All readings" }).getAttribute("href")
  ).toBe(`/estates/${ESTATE}/readings`);
});

it("links All readings even when there is only one asset view", () => {
  access.allDevices = false;
  renderWithProviders(<AssetViewsNav estateId={ESTATE} />);
  expect(screen.queryByRole("navigation", { name: "Asset views" })).toBeNull();
  screen.getByRole("link", { name: "All readings" });
});

it("offers no All readings link without that access", () => {
  access.allReadings = false;
  renderWithProviders(<AssetViewsNav estateId={ESTATE} />);
  expect(screen.queryByRole("link", { name: "All readings" })).toBeNull();
});
