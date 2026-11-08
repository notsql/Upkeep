import { createFileRoute, redirect } from "@tanstack/react-router";

/** This section moved into Records; old links still land there. */
export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/_details/inspections/"
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      params,
      replace: true,
      to: "/estates/$estateId/assets/$assetId/records",
    });
  },
});
