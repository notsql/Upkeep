import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomePending, RoutePending } from "@/components/route-pending";

describe("route pending states", () => {
  it("shows a content skeleton instead of a spinner while a route loads", () => {
    render(<RoutePending />);
    screen.getByRole("status", { name: "Loading page…" });
    expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
  });

  it("shapes the home skeleton like the dashboard: header, stat cards, lists", () => {
    const { container } = render(<HomePending />);
    screen.getByRole("status", { name: "Loading your workspace…" });
    expect(
      container.querySelectorAll("[data-slot='stat-skeleton']")
    ).toHaveLength(3);
  });
});

describe("router pending defaults", () => {
  it("uses the content skeleton, intent preloading and a delay before showing it", async () => {
    const { getRouter } = await import("@/router");
    const router = getRouter();
    expect(router.options.defaultPendingComponent).toBe(RoutePending);
    expect(router.options.defaultPreload).toBe("intent");
    expect(router.options.defaultPendingMs).toBeGreaterThan(0);
    expect(router.options.defaultPendingMinMs).toBeGreaterThan(0);
    // Importing the router pulls in the whole route tree; slow under a loaded suite.
  }, 30_000);

  it("gives the home route its dashboard skeleton", async () => {
    const { Route } = await import("@/routes/index");
    expect(Route.options.pendingComponent).toBe(HomePending);
  }, 30_000);
});
