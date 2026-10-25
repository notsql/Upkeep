import type { components } from "@proj/api/schema";
import { fireEvent } from "@testing-library/react";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkOrderDetailPage } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page";

const state = vi.hoisted(() => ({
  access: {
    canView: true,
    canCreate: false,
    canUpdate: false,
    canReadReports: false,
    canViewAssets: false,
    pending: false,
    estateName: "Oak",
  },
  currentId: "order",
  error: false,
  queryError: undefined as Error | undefined,
  creatorName: "Alex Tan" as string | undefined,
  status: "OPEN",
  version: 0,
  refetch: vi.fn(),
  changeStatus: vi.fn(),
  complete: vi.fn(),
  correct: vi.fn(),
  completion: undefined as
    | components["schemas"]["WorkOrderCompletionResponse"]
    | undefined,
  revisions:
    [] as components["schemas"]["WorkOrderCompletionRevisionResponse"][],
  history: [] as {
    id: string;
    fromStatus: string;
    toStatus: string;
    changedByName: string;
    changedAt: string;
    version: number;
  }[],
  refetchHistory: vi.fn(),
}));
vi.mock("@/lib/work-orders", () => ({
  useWorkOrderAccess: () => state.access,
  useWorkOrder: () => ({
    isError: state.error,
    error: state.queryError,
    refetch: state.refetch,
    data: {
      id: state.currentId,
      reference: "OAK-W0001",
      description: "Repair pump",
      locationPath: "Block A / L1",
      assetId: "pump",
      assetReference: "OAK-A0001",
      category: "EQUIPMENT_FAULT",
      priority: "HIGH",
      source: "RESIDENT_REPORT",
      sourceReportId: "report",
      status: state.status,
      version: state.version,
      completion: state.completion,
      createdAt: "2026-10-22T00:00:00Z",
      createdByUserId: "manager",
      createdByName: state.creatorName,
    },
  }),
  useWorkOrderStatusHistory: () => ({
    data: state.history,
    isPending: false,
    isError: false,
    refetch: state.refetchHistory,
  }),
  useChangeWorkOrderStatus: () => ({
    mutateAsync: state.changeStatus,
    isPending: false,
  }),
  useWorkOrderCompletionRevisions: () => ({
    data: state.revisions,
    isPending: false,
    isError: false,
    refetch: vi.fn().mockResolvedValue({}),
  }),
  useCorrectWorkOrderCompletion: () => ({
    mutateAsync: state.correct,
    isPending: false,
  }),
  useSaveWorkOrderCompletion: () => ({
    mutateAsync: state.complete,
    isPending: false,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
beforeEach(() => {
  state.access.canView = true;
  state.access.canReadReports = false;
  state.access.canViewAssets = false;
  state.access.canUpdate = false;
  state.status = "OPEN";
  state.version = 0;
  state.refetch.mockReset().mockResolvedValue({});
  state.refetchHistory.mockReset().mockResolvedValue({});
  state.history = [];
  state.changeStatus.mockReset().mockResolvedValue({});
  state.completion = undefined;
  state.revisions = [];
  state.correct.mockReset().mockResolvedValue({});
  state.complete.mockReset().mockResolvedValue({});
  state.error = false;
  state.currentId = "order";
  state.queryError = undefined;
  state.creatorName = "Alex Tan";
});
it("lets Managers explicitly start unassigned work using the observed version", async () => {
  state.access.canUpdate = true;
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  fireEvent.click(screen.getByRole("button", { name: "Start work" }));
  await waitFor(() =>
    expect(state.changeStatus).toHaveBeenCalledWith({
      targetStatus: "IN_PROGRESS",
      expectedVersion: 0,
    })
  );
});
it("refreshes stale status history and clears the conflict warning after recovery", async () => {
  state.access.canUpdate = true;
  state.changeStatus.mockRejectedValue(
    new Error("This work order changed. Refresh and review it before saving.")
  );
  const view = renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  state.refetch.mockImplementation(() => {
    state.status = "IN_PROGRESS";
    state.version = 1;
    view.rerender(<WorkOrderDetailPage estateId="oak" workOrderId="order" />);
    return Promise.resolve({});
  });
  state.refetchHistory.mockImplementation(() => {
    state.history = [
      {
        id: "started",
        fromStatus: "OPEN",
        toStatus: "IN_PROGRESS",
        changedByName: "Alex Tan",
        changedAt: "2026-10-24T00:00:00Z",
        version: 1,
      },
    ];
    view.rerender(<WorkOrderDetailPage estateId="oak" workOrderId="order" />);
    return Promise.resolve({});
  });
  fireEvent.click(screen.getByRole("button", { name: "Start work" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Refresh work order" })
  );
  await screen.findByText("OPEN → IN PROGRESS");
  screen.getByRole("button", { name: "Complete work order" });
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});
it("keeps Crew read-only even when an order is in progress", () => {
  state.status = "IN_PROGRESS";
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  expect(screen.queryByRole("button", { name: "Start work" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Complete work order" })
  ).toBeNull();
});
it("records explicit zero costs and downtime while retaining unknown fields", async () => {
  state.access.canUpdate = true;
  state.status = "IN_PROGRESS";
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  fireEvent.click(screen.getByRole("button", { name: "Complete work order" }));
  const dialog = within(
    await screen.findByRole("dialog", { name: "Complete work order" })
  );
  fireEvent.change(dialog.getByRole("textbox", { name: "Findings" }), {
    target: { value: " Worn seal " },
  });
  fireEvent.change(dialog.getByRole("textbox", { name: "Work performed" }), {
    target: { value: " Replaced seal " },
  });
  fireEvent.change(dialog.getByRole("textbox", { name: "Parts cost (SGD)" }), {
    target: { value: "0" },
  });
  fireEvent.change(
    dialog.getByRole("spinbutton", { name: "Downtime (minutes)" }),
    { target: { value: "0" } }
  );
  fireEvent.click(dialog.getByRole("button", { name: "Complete work order" }));
  await waitFor(() =>
    expect(state.complete).toHaveBeenCalledWith({
      expectedVersion: 0,
      findings: "Worn seal",
      workPerformed: "Replaced seal",
      partsCost: "0",
      downtimeMinutes: 0,
    })
  );
});
it("keeps completion input after a save failure", async () => {
  state.access.canUpdate = true;
  state.status = "IN_PROGRESS";
  state.complete.mockRejectedValue(new TypeError("Failed to fetch"));
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  fireEvent.click(screen.getByRole("button", { name: "Complete work order" }));
  const dialog = within(
    await screen.findByRole("dialog", { name: "Complete work order" })
  );
  fireEvent.change(dialog.getByRole("textbox", { name: "Findings" }), {
    target: { value: "Worn seal" },
  });
  fireEvent.change(dialog.getByRole("textbox", { name: "Work performed" }), {
    target: { value: "Replaced seal" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Complete work order" }));
  await dialog.findByRole("alert");
  expect(
    (dialog.getByRole("textbox", { name: "Findings" }) as HTMLTextAreaElement)
      .value
  ).toBe("Worn seal");
});
it("shows the creator's display name instead of their internal ID", () => {
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  screen.getByText("Alex Tan");
  expect(screen.queryByText("manager")).toBeNull();
});
it("uses a readable fallback when the creator name is unavailable", () => {
  state.creatorName = undefined;
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  screen.getByText("Name unavailable");
  expect(screen.queryByText("manager")).toBeNull();
});
it("shows Crew the saved asset reference without an owner-only asset link", () => {
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  screen.getByText("OAK-A0001");
  screen.getByText("Block A / L1");
  expect(screen.queryByRole("link", { name: "OAK-A0001" })).toBeNull();
  expect(screen.queryByRole("link", { name: "View source report" })).toBeNull();
});
it("links source reports only for independent report readers", () => {
  state.access.canReadReports = true;
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  screen.getByRole("link", { name: "View source report" });
});
it("hides cached work-order content after access is revoked", () => {
  state.access.canView = false;
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  expect(screen.queryByText("Repair pump")).toBeNull();
  screen.getByRole("alert");
});
it("hides cached work-order content when refetching fails", () => {
  state.error = true;
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  expect(screen.queryByText("Repair pump")).toBeNull();
  screen.getByRole("alert");
});

it("keeps the reviewed version during background refresh and requires explicit review after a conflict", async () => {
  state.access.canUpdate = true;
  state.status = "IN_PROGRESS";
  state.complete.mockRejectedValueOnce(
    Object.assign(new Error("This work order changed."), { status: 409 })
  );
  const view = renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  fireEvent.click(screen.getByRole("button", { name: "Complete work order" }));
  const dialog = within(
    await screen.findByRole("dialog", { name: "Complete work order" })
  );
  fireEvent.change(dialog.getByRole("textbox", { name: "Findings" }), {
    target: { value: "Worn seal" },
  });
  fireEvent.change(dialog.getByRole("textbox", { name: "Work performed" }), {
    target: { value: "Replaced seal" },
  });
  state.version = 1;
  view.rerender(<WorkOrderDetailPage estateId="oak" workOrderId="order" />);
  fireEvent.click(dialog.getByRole("button", { name: "Complete work order" }));
  await dialog.findByRole("alert");
  expect(state.complete).toHaveBeenCalledWith({
    expectedVersion: 0,
    findings: "Worn seal",
    workPerformed: "Replaced seal",
  });
  expect(
    (
      dialog.getByRole("button", {
        name: "Complete work order",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  fireEvent.click(dialog.getByRole("button", { name: "Refresh work order" }));
  fireEvent.click(
    await dialog.findByRole("button", {
      name: "I reviewed the updated work order",
    })
  );
  fireEvent.click(dialog.getByRole("button", { name: "Complete work order" }));
  await waitFor(() =>
    expect(state.complete).toHaveBeenLastCalledWith({
      expectedVersion: 1,
      findings: "Worn seal",
      workPerformed: "Replaced seal",
    })
  );
});

const savedOutcome = {
  id: "completion",
  findings: "Worn seal",
  workPerformed: "Replaced seal",
  partsUsed: "Seal",
  labourCost: "12.30",
  partsCost: "4.70",
  totalCost: "17.00",
  currency: "SGD",
  downtimeMinutes: 30,
  completedByUserId: "manager",
  completedByName: "Alex Tan",
  completedAt: "2026-10-24T00:00:00Z",
};
it("prefills a closed outcome and sends corrections with a reason, explicit zeros and cleared unknowns", async () => {
  state.access.canUpdate = true;
  state.status = "CLOSED";
  state.version = 2;
  state.completion = savedOutcome;
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit outcome" }));
  const dialog = within(
    await screen.findByRole("dialog", { name: "Edit completion outcome" })
  );
  expect(
    (dialog.getByRole("textbox", { name: "Findings" }) as HTMLTextAreaElement)
      .value
  ).toBe("Worn seal");
  expect(
    (
      dialog.getByRole("textbox", {
        name: "Labour cost (SGD)",
      }) as HTMLInputElement
    ).value
  ).toBe("12.30");
  fireEvent.change(dialog.getByRole("textbox", { name: "Labour cost (SGD)" }), {
    target: { value: "" },
  });
  fireEvent.change(dialog.getByRole("textbox", { name: "Parts used" }), {
    target: { value: "" },
  });
  fireEvent.change(dialog.getByRole("textbox", { name: "Parts cost (SGD)" }), {
    target: { value: "0" },
  });
  fireEvent.change(
    dialog.getByRole("spinbutton", { name: "Downtime (minutes)" }),
    { target: { value: "0" } }
  );
  fireEvent.change(dialog.getByRole("textbox", { name: "Correction reason" }), {
    target: { value: " Invoice correction " },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Save correction" }));
  await waitFor(() =>
    expect(state.correct).toHaveBeenCalledWith({
      expectedVersion: 2,
      correctionReason: "Invoice correction",
      findings: "Worn seal",
      workPerformed: "Replaced seal",
      partsUsed: null,
      labourCost: null,
      partsCost: "0",
      downtimeMinutes: 0,
    })
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("requires a correction reason and keeps edits through a failed save and stale-version review", async () => {
  state.access.canUpdate = true;
  state.status = "CLOSED";
  state.version = 2;
  state.completion = savedOutcome;
  state.correct.mockRejectedValueOnce(
    Object.assign(new Error("This work order changed."), { status: 409 })
  );
  const view = renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit outcome" }));
  const dialog = within(
    await screen.findByRole("dialog", { name: "Edit completion outcome" })
  );
  expect(
    (
      dialog.getByRole("textbox", {
        name: "Correction reason",
      }) as HTMLTextAreaElement
    ).required
  ).toBe(true);
  fireEvent.change(dialog.getByRole("textbox", { name: "Findings" }), {
    target: { value: "Corrected findings" },
  });
  fireEvent.change(dialog.getByRole("textbox", { name: "Correction reason" }), {
    target: { value: "Fix typo" },
  });
  state.version = 3;
  view.rerender(<WorkOrderDetailPage estateId="oak" workOrderId="order" />);
  fireEvent.click(dialog.getByRole("button", { name: "Save correction" }));
  await dialog.findByRole("alert");
  expect(
    (dialog.getByRole("textbox", { name: "Findings" }) as HTMLTextAreaElement)
      .value
  ).toBe("Corrected findings");
  expect(
    (
      dialog.getByRole("button", {
        name: "Save correction",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  fireEvent.click(dialog.getByRole("button", { name: "Refresh work order" }));
  fireEvent.click(
    await dialog.findByRole("button", {
      name: "I reviewed the updated work order",
    })
  );
  fireEvent.click(dialog.getByRole("button", { name: "Save correction" }));
  await waitFor(() =>
    expect(state.correct).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expectedVersion: 3,
        findings: "Corrected findings",
        correctionReason: "Fix typo",
      })
    )
  );
});
it("shows Crew the correction audit without editing controls", () => {
  state.status = "CLOSED";
  state.completion = {
    ...savedOutcome,
    editedByName: "Morgan Lee",
    editedAt: "2026-10-24T01:00:00Z",
  };
  state.revisions = [
    {
      id: "revision",
      fromVersion: 2,
      version: 3,
      correctionReason: "Correct invoice",
      changedByUserId: "other-manager",
      changedByName: "Morgan Lee",
      changedAt: "2026-10-24T01:00:00Z",
      before: savedOutcome,
      after: { ...savedOutcome, labourCost: "0.00", totalCost: "4.70" },
    },
  ];
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  expect(screen.queryByRole("button", { name: "Edit outcome" })).toBeNull();
  screen.getByRole("heading", { name: "Outcome corrections" });
  screen.getByText("Correct invoice");
  screen.getByRole("button", { name: "View before and after" });
});

it("keeps the correction draft when refreshing its current version fails over the network", async () => {
  state.access.canUpdate = true;
  state.status = "CLOSED";
  state.version = 2;
  state.completion = savedOutcome;
  state.correct.mockRejectedValue(
    Object.assign(new Error("This work order changed."), { status: 409 })
  );
  const view = renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  state.refetch.mockImplementation(() => {
    state.error = true;
    state.queryError = new TypeError("Failed to fetch");
    view.rerender(<WorkOrderDetailPage estateId="oak" workOrderId="order" />);
    return Promise.reject(state.queryError);
  });
  fireEvent.click(screen.getByRole("button", { name: "Edit outcome" }));
  const dialog = within(
    await screen.findByRole("dialog", { name: "Edit completion outcome" })
  );
  fireEvent.change(dialog.getByRole("textbox", { name: "Correction reason" }), {
    target: { value: "Fix typo" },
  });
  fireEvent.change(dialog.getByRole("textbox", { name: "Findings" }), {
    target: { value: "Keep my draft" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Save correction" }));
  fireEvent.click(
    await dialog.findByRole("button", { name: "Refresh work order" })
  );
  const stillOpen = within(
    await screen.findByRole("dialog", { name: "Edit completion outcome" })
  );
  expect(
    (
      stillOpen.getByRole("textbox", {
        name: "Findings",
      }) as HTMLTextAreaElement
    ).value
  ).toBe("Keep my draft");
  expect(
    stillOpen.queryByRole("button", {
      name: "I reviewed the updated work order",
    })
  ).toBeNull();
  await stillOpen.findByText(
    "Unable to refresh the work order and history. Please try again."
  );
});

it("keeps a completion dialog in completion mode when refresh reveals a saved outcome", async () => {
  state.access.canUpdate = true;
  state.status = "IN_PROGRESS";
  state.version = 1;
  state.complete.mockRejectedValue(new TypeError("Failed to fetch"));
  const view = renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  state.refetch.mockImplementation(() => {
    state.status = "CLOSED";
    state.version = 2;
    state.completion = savedOutcome;
    view.rerender(<WorkOrderDetailPage estateId="oak" workOrderId="order" />);
    return Promise.resolve({});
  });
  fireEvent.click(screen.getByRole("button", { name: "Complete work order" }));
  const dialog = within(
    await screen.findByRole("dialog", { name: "Complete work order" })
  );
  fireEvent.change(dialog.getByRole("textbox", { name: "Findings" }), {
    target: { value: "Worn seal" },
  });
  fireEvent.change(dialog.getByRole("textbox", { name: "Work performed" }), {
    target: { value: "Replaced seal" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Complete work order" }));
  fireEvent.click(
    await dialog.findByRole("button", { name: "Refresh work order" })
  );
  const unchangedMode = within(
    await screen.findByRole("dialog", { name: "Complete work order" })
  );
  await unchangedMode.findByText("Current status: CLOSED");
  expect(
    unchangedMode.queryByRole("textbox", { name: "Correction reason" })
  ).toBeNull();
  expect(
    (
      unchangedMode.getByRole("button", {
        name: "Complete work order",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
});
it("does not carry a correction draft into another work order", async () => {
  state.access.canUpdate = true;
  state.status = "CLOSED";
  state.completion = savedOutcome;
  const view = renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit outcome" }));
  await screen.findByRole("dialog", { name: "Edit completion outcome" });
  state.currentId = "other-order";
  view.rerender(
    <WorkOrderDetailPage estateId="oak" workOrderId="other-order" />
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
