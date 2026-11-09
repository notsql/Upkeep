import { redirectFrom } from "@tests/route-redirect";
import { expect, it } from "vitest";
import { Route } from "@/routes/_auth/estates/$estateId/readings/index";

const estateId = "3f6c1f9e-8a2b-4c5d-9e0f-1a2b3c4d5e6f";
const assetId = "7d0f3c1e-2b4a-4c6d-8e9f-0a1b2c3d4e5f";

it("moves an asset filter into the path", () => {
  expect(
    redirectFrom(Route, {
      params: { estateId },
      search: { assetId, suspect: true },
    })
  ).toMatchObject({
    params: { estateId, assetId },
    replace: true,
    search: { suspect: true },
    to: "/estates/$estateId/readings/$assetId",
  });
});

it("keeps estate-wide browsing on /readings", () => {
  expect(
    redirectFrom(Route, { params: { estateId }, search: { suspect: true } })
  ).toBeUndefined();
});
