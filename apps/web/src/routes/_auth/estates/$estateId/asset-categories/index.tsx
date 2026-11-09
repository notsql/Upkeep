import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old bookmark: Asset categories is now Check schedules under Inspections. */
export const Route = createFileRoute(
  "/_auth/estates/$estateId/asset-categories/"
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      params,
      replace: true,
      to: "/estates/$estateId/inspections/schedules",
    });
  },
});
