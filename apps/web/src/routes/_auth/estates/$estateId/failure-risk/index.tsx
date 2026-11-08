import { createFileRoute, redirect } from "@tanstack/react-router";

// Retired page: its bookmarks land on the Assets view that replaced it.
export const Route = createFileRoute("/_auth/estates/$estateId/failure-risk/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/estates/$estateId/assets",
      params: { estateId: params.estateId },
      replace: true,
    });
  },
});
