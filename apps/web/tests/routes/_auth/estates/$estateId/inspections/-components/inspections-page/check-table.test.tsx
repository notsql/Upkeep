import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InspectionCheck } from "@/lib/inspection-list";
import { CheckTable } from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page/check-table";

const SEND_STEP = /Send step/u;

const state = vi.hoisted(() => ({
  risks: [] as { assetId: string; flagReasons: string[] }[],
  canCreate: true,
  mobile: false,
}));

vi.mock("@/lib/use-mobile", () => ({ useMobile: () => state.mobile }));

vi.mock("@/lib/failure-risk", () => ({
  useEstateFailureRisk: () => ({ data: state.risks }),
}));
vi.mock("@/lib/inspections", () => ({
  useInspectionAccess: () => ({ canCreateWorkOrders: state.canCreate }),
}));
vi.mock("@/components/dispatch/dispatch-action", () => ({
  DispatchAction: ({ route }: { route: string }) => (
    <span>{`Send step ${route}`}</span>
  ),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

function check(overrides: Partial<InspectionCheck>): InspectionCheck {
  return {
    id: "check",
    assetId: "pump",
    assetReference: "P-1",
    assetName: "Booster pump",
    categoryLabel: "Pump",
    block: { id: "b", name: "Block A" },
    level: null,
    dueOn: "2026-11-09",
    dueBasis: "PREDICTION",
    interval: null,
    intervalSource: null,
    status: "DUE",
    result: null,
    requestedByName: null,
    assignedToName: null,
    ...overrides,
  } as InspectionCheck;
}

function row(checks: InspectionCheck[]) {
  renderWithProviders(
    <CheckTable canRecord checks={checks} estateId="estate" />
  );
  return within(screen.getAllByRole("row")[1]);
}

beforeEach(() => {
  state.risks = [];
  state.canCreate = true;
  state.mobile = false;
});

describe("CheckTable", () => {
  it("says who was sent, and by whom, for a check a manager requested", () => {
    const cells = row([
      check({
        dueBasis: "REQUESTED",
        requestedByName: "Morgan Lee",
        assignedToName: "Ahmad Rahman",
      }),
    ]);
    cells.getByText("Sent to Ahmad Rahman by Morgan Lee");
  });

  it("offers to send a contractor for a predicted check at the end of its life", () => {
    state.risks = [{ assetId: "pump", flagReasons: ["END_OF_LIFE"] }];
    const cells = row([check({})]);
    cells.getByText("Send step CONTRACTOR");
    cells.getByRole("link", { name: "Record inspection" });
  });

  it("offers no contractor for a predicted check that is not at the end of its life", () => {
    state.risks = [{ assetId: "pump", flagReasons: ["FAILURE_RISK"] }];
    const cells = row([check({})]);
    expect(cells.queryByText(SEND_STEP)).toBeNull();
  });

  it("offers no contractor to a reader who cannot send one", () => {
    state.risks = [{ assetId: "pump", flagReasons: ["END_OF_LIFE"] }];
    state.canCreate = false;
    const cells = row([check({})]);
    expect(cells.queryByText(SEND_STEP)).toBeNull();
  });

  describe("on a phone", () => {
    it("lists each check with the asset first, then category, due date and basis", () => {
      state.mobile = true;
      state.risks = [{ assetId: "pump", flagReasons: ["END_OF_LIFE"] }];
      renderWithProviders(
        <CheckTable canRecord checks={[check({})]} estateId="estate" />
      );
      expect(screen.queryByRole("table")).toBeNull();
      const list = within(screen.getByRole("list", { name: "Checks" }));
      const item = within(list.getAllByRole("listitem")[0]);
      item.getByRole("link", { name: "Booster pump" });
      item.getByText("P-1 · Pump");
      item.getByText("Due 9 Nov 2026 · Expected");
      item.getByText("Due");
      item.getByText("Send step CONTRACTOR");
      item.getByRole("link", { name: "Record inspection" });
    });
  });
});
