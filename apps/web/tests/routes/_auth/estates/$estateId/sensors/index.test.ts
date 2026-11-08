import { redirectFrom } from "@tests/route-redirect";
import { expect, it } from "vitest";
import { Route } from "@/routes/_auth/estates/$estateId/sensors/index";

it("replaces the retired page with its Assets view", () => {
  expect(
    redirectFrom(Route, {
      params: { estateId: "3f6c1f9e-8a2b-4c5d-9e0f-1a2b3c4d5e6f" },
    })
  ).toMatchObject({
    params: { estateId: "3f6c1f9e-8a2b-4c5d-9e0f-1a2b3c4d5e6f" },
    replace: true,
    to: "/estates/$estateId/assets/devices",
  });
});
