import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/states/not-found-page";
import { RoutePending } from "@/components/states/route-pending";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Created per router instance, never at module scope: this app server-side
  // renders, and a module-level client would be shared across requests, leaking
  // one user's cached data into another's response.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Avoids an immediate refetch of data the server just rendered.
        staleTime: 60 * 1000,
      },
    },
  });

  const router = createTanStackRouter({
    context: { queryClient },
    defaultNotFoundComponent: NotFoundPage,
    defaultPendingComponent: RoutePending,
    // Fast loads never show the skeleton; slow ones keep it long enough not to flicker.
    defaultPendingMinMs: 300,
    defaultPendingMs: 200,
    // Hovering or focusing a link runs its guards and loaders ahead of the click.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
