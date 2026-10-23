import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkOrderRequestError } from "@/lib/work-orders";
import { WorkOrderForm } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  navigate: vi.fn(),
  report: vi.fn(),
  reload: vi.fn(),
  access: {
    canView: true,
    canCreate: true,
    canReadReports: true,
    canViewAssets: false,
    pending: false,
    estateName: "Oak",
  },
  pending: false,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));
vi.mock("@/lib/work-orders", () => ({
  useWorkOrderAccess: () => mocks.access,
  useCreateWorkOrder: () => ({
    mutateAsync: mocks.save,
    isPending: mocks.pending,
    error: null,
  }),
  useWorkOrderAssets: () => ({
    data: { items: [], nextCursor: null },
    isError: false,
    isPending: false,
  }),
  WorkOrderRequestError: class extends Error {
    status = 409;
  },
}));
vi.mock("@/lib/locations", () => ({
  useLocations: () => ({
    data: [{ id: "level", name: "Level 1", type: "LEVEL" }],
    isError: false,
    isPending: false,
  }),
  flattenLocations: () => [{ id: "level", path: ["Block A", "Level 1"] }],
}));
vi.mock("@/lib/estate-reports", () => ({
  useEstateReport: () => mocks.report(),
  useEstateReportList: () => ({
    data: { items: [], nextCursor: null },
    isError: false,
    isPending: false,
  }),
}));
beforeEach(() => {
  mocks.save.mockReset().mockResolvedValue({ id: "saved" });
  mocks.navigate.mockReset();
  mocks.report.mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    refetch: mocks.reload,
  });
  mocks.pending = false;
  mocks.access.canCreate = true;
});

it("creates an equipment fault without a registered asset", async () => {
  renderWithProviders(<WorkOrderForm estateId="oak" />);
  fireEvent.change(screen.getByRole("textbox", { name: "Description" }), {
    target: { value: "Broken pump" },
  });
  await chooseOption(
    screen.getByRole("combobox", { name: "Location" }),
    "Block A / Level 1"
  );
  fireEvent.click(screen.getByRole("button", { name: "Create work order" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Broken pump",
        locationId: "level",
        category: "EQUIPMENT_FAULT",
        source: "MANUAL",
      })
    )
  );
  expect(mocks.save.mock.calls[0][0].assetId).toBeUndefined();
});

it("automatically makes safety urgent", async () => {
  renderWithProviders(<WorkOrderForm estateId="oak" />);
  await chooseOption(
    screen.getByRole("combobox", { name: "Category" }),
    "Safety"
  );
  expect(
    screen.getByRole("combobox", { name: "Priority" }).textContent
  ).toContain("Urgent");
  expect(
    screen.getByRole("combobox", { name: "Priority" }).hasAttribute("disabled")
  ).toBe(true);
});

it("requires an explanation for a manually entered inspection source", async () => {
  renderWithProviders(<WorkOrderForm estateId="oak" />);
  await chooseOption(
    screen.getByRole("combobox", { name: "Source" }),
    "Inspection"
  );
  expect(
    screen
      .getByRole("textbox", { name: "Source reference or explanation" })
      .hasAttribute("required")
  ).toBe(true);
});

it("prefills a report once and preserves edits on background refetch", async () => {
  const report = {
    id: "report",
    description: "Original description",
    location: { id: "level", label: "Level 1" },
  };
  mocks.report.mockReturnValue({
    data: report,
    isPending: false,
    isError: false,
    refetch: mocks.reload,
  });
  const view = renderWithProviders(
    <WorkOrderForm estateId="oak" sourceReportId="report" />
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("textbox", {
          name: "Description",
        }) as HTMLTextAreaElement
      ).value
    ).toBe("Original description")
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Description" }), {
    target: { value: "Edited description" },
  });
  mocks.report.mockReturnValue({
    data: { ...report, description: "Refetched description" },
    isPending: false,
    isError: false,
    refetch: mocks.reload,
  });
  view.rerender(<WorkOrderForm estateId="oak" sourceReportId="report" />);
  expect(
    (
      screen.getByRole("textbox", {
        name: "Description",
      }) as HTMLTextAreaElement
    ).value
  ).toBe("Edited description");
  fireEvent.click(screen.getByRole("button", { name: "Create work order" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Edited description",
        source: "RESIDENT_REPORT",
        sourceReportId: "report",
        expectedSourceLocationId: "level",
      })
    )
  );
});

it("hides creation from Crew", () => {
  mocks.access.canCreate = false;
  renderWithProviders(<WorkOrderForm estateId="oak" />);
  expect(
    screen.queryByRole("button", { name: "Create work order" })
  ).toBeNull();
});

it("disables saving while a selected source is loading", async () => {
  mocks.report.mockReturnValue({
    data: {
      id: "report",
      description: "Leak",
      location: { id: "level", label: "L1" },
    },
    isPending: false,
    isError: false,
    refetch: mocks.reload,
  });
  const view = renderWithProviders(
    <WorkOrderForm estateId="oak" sourceReportId="report" />
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("textbox", {
          name: "Description",
        }) as HTMLTextAreaElement
      ).value
    ).toBe("Leak")
  );
  mocks.report.mockReturnValue({
    data: undefined,
    isPending: true,
    isError: false,
    refetch: mocks.reload,
  });
  view.rerender(<WorkOrderForm estateId="oak" sourceReportId="report" />);
  expect(
    screen
      .getByRole("button", { name: "Create work order" })
      .hasAttribute("disabled")
  ).toBe(true);
});

it("disables save while the request is pending", () => {
  mocks.pending = true;
  renderWithProviders(<WorkOrderForm estateId="oak" />);
  expect(
    screen
      .getByRole("button", { name: "Create work order" })
      .hasAttribute("disabled")
  ).toBe(true);
});

it("reloads a stale source placement while keeping edited description and work location", async () => {
  const report = {
    id: "report",
    description: "Source description",
    location: { id: "level", label: "Level 1" },
  };
  mocks.report.mockReturnValue({
    data: report,
    isPending: false,
    isError: false,
    refetch: mocks.reload,
  });
  mocks.save.mockRejectedValueOnce(
    new WorkOrderRequestError("The report location changed.", 409)
  );
  mocks.reload.mockResolvedValue({
    data: { ...report, location: { id: "moved-source", label: "Block B" } },
    isError: false,
  });
  renderWithProviders(<WorkOrderForm estateId="oak" sourceReportId="report" />);
  await waitFor(() =>
    expect(
      (
        screen.getByRole("textbox", {
          name: "Description",
        }) as HTMLTextAreaElement
      ).value
    ).toBe("Source description")
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Description" }), {
    target: { value: "Edited description" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create work order" }));
  await screen.findByText("The report location changed.");
  fireEvent.click(screen.getByRole("button", { name: "Reload source" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Reload source" })).toBeNull()
  );
  expect(
    (
      screen.getByRole("textbox", {
        name: "Description",
      }) as HTMLTextAreaElement
    ).value
  ).toBe("Edited description");
  fireEvent.click(screen.getByRole("button", { name: "Create work order" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        description: "Edited description",
        locationId: "level",
        sourceReportId: "report",
        expectedSourceLocationId: "moved-source",
      })
    )
  );
});
