import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * A plain parent for every asset route, so the `_details` layout below is
 * pathless and does not swallow its siblings (edit, inspections/new, …).
 */
export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId"
)({ component: Outlet });
