import { renderWithProviders, screen } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FailedCheckAction } from "@/components/dispatch/failed-check-action";

const state = vi.hoisted(() => ({
  workOrder: null as { id: string; reference: string } | null,
}));

vi.mock("@/lib/inspections", () => ({
  useInspectionSource: () => ({
    isPending: false,
    data: { workOrder: state.workOrder },
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
  }) => {
    let href = to;
    for (const [key, value] of Object.entries(params ?? {})) {
      href = href.replace(`$${key}`, value);
    }
    const query = new URLSearchParams(search ?? {}).toString();
    return <a href={query ? `${href}?${query}` : href}>{children}</a>;
  },
}));

beforeEach(() => {
  state.workOrder = null;
});

describe("FailedCheckAction", () => {
  it("opens the work order form filled in from the failed inspection", () => {
    renderWithProviders(
      <FailedCheckAction estateId="estate" inspectionResultId="result" />
    );
    expect(
      screen
        .getByRole("link", { name: "Send a contractor" })
        .getAttribute("href")
    ).toBe("/estates/estate/work-orders/new?sourceInspectionId=result");
  });

  it("names the work order already raised for that inspection", () => {
    state.workOrder = { id: "wo", reference: "EST-W0003" };
    renderWithProviders(
      <FailedCheckAction estateId="estate" inspectionResultId="result" />
    );
    screen.getByRole("link", { name: "Contractor already sent · EST-W0003" });
    expect(
      screen.queryByRole("link", { name: "Send a contractor" })
    ).toBeNull();
  });
});
