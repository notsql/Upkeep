import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old bookmark: one interval view, now under Check schedules. */
export const Route = createFileRoute(
  "/_auth/estates/$estateId/asset-categories/$interval/"
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      params,
      replace: true,
      to: "/estates/$estateId/inspections/schedules/$interval",
    });
  },
});
