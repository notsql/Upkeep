import type { components } from "@proj/api/schema";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent } from "@testing-library/react";
import {
  crewEstateAccess,
  ownerEstateAccess,
  workspaceAccess,
} from "@tests/fixtures/access";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkOrderContractorEmail } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-contractor-email";

const { get, post, state } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  state: { role: "MANAGER", dispatch: null as unknown },
}));
vi.mock("@/lib/api", () => ({ api: { GET: get, POST: post } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "manager" }, loading: false }),
}));

const estateId = "estate";
const timestamp = "2026-10-01T00:00:00Z";
const order = {
  id: "order",
  category: "EQUIPMENT_FAULT",
  source: "RESIDENT_REPORT",
  status: "OPEN",
} as components["schemas"]["WorkOrderResponse"];
const sent = {
  equipmentType: "PUMP",
  contractorName: "Pump Co",
  contractorEmail: "pumps@example.com",
  approval: "AUTOMATIC",
  status: "SENT",
  sentAt: timestamp,
  createdAt: timestamp,
};

function serve(path: string) {
  if (path === "/access/context") {
    const permission =
      state.role === "MANAGER" ? ownerEstateAccess : crewEstateAccess;
    return Promise.resolve({
      data: {
        ...workspaceAccess,
        estates: [{ ...permission, estateId, canViewWorkOrders: true }],
      },
    });
  }
  if (path === "/estates/{estateId}/work-orders/{workOrderId}/dispatch") {
    return Promise.resolve({ data: { dispatch: state.dispatch } });
  }
  if (path === "/estates/{estateId}/contractors") {
    return Promise.resolve({
      data: [
        {
          equipmentType: "PUMP",
          name: "Pump Co",
          email: "pumps@example.com",
          updatedAt: timestamp,
        },
      ],
    });
  }
  return Promise.resolve({ data: [] });
}

function render(
  role: string,
  target: components["schemas"]["WorkOrderResponse"] = order
) {
  state.role = role;
  return renderWithProviders(
    <WorkOrderContractorEmail
      canCreate={role === "MANAGER"}
      estateId={estateId}
      order={target}
    />
  );
}

beforeEach(() => {
  state.dispatch = null;
  get.mockReset().mockImplementation(serve);
  post.mockReset().mockResolvedValue({ data: { ...sent, status: "PENDING" } });
});

it("shows who was emailed, how it was approved and when it was sent", async () => {
  state.dispatch = sent;
  render("CREW");

  await screen.findByText("Pump Co (pumps@example.com)");
  screen.getByText("Pump");
  screen.getByText("Sent automatically");
  screen.getByText(`Sent ${new Date(timestamp).toLocaleString()}`);
  expect(screen.queryByRole("button", { name: "Email contractor" })).toBeNull();
});

it("lets a manager assign and email the contractor for an open order", async () => {
  render("MANAGER");
  await screen.findByText(
    "No contractor has been emailed about this work order."
  );

  fireEvent.click(screen.getByRole("button", { name: "Email contractor" }));
  const dialog = within(await screen.findByRole("dialog"));
  await chooseOption(
    dialog.getByRole("combobox", { name: "Equipment type" }),
    "Pump"
  );
  dialog.getByText("Pump Co (pumps@example.com) will be assigned and emailed.");
  fireEvent.click(dialog.getByRole("button", { name: "Assign and email" }));

  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      "/estates/{estateId}/work-orders/{workOrderId}/dispatch",
      {
        params: { path: { estateId, workOrderId: "order" } },
        body: { equipmentType: "PUMP" },
      }
    )
  );
});

it("offers no email for an order that is no longer open", async () => {
  render("MANAGER", { ...order, status: "IN_PROGRESS" });

  await screen.findByText(
    "No contractor has been emailed about this work order."
  );
  expect(screen.queryByRole("button", { name: "Email contractor" })).toBeNull();
});

it("lets a manager, but not crew, retry an email that failed", async () => {
  state.dispatch = { ...sent, status: "FAILED", sentAt: null };
  render("MANAGER");
  await screen.findByText("Failed to send");

  fireEvent.click(screen.getByRole("button", { name: "Retry sending" }));

  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      "/estates/{estateId}/work-orders/{workOrderId}/dispatch/retry",
      { params: { path: { estateId, workOrderId: "order" } } }
    )
  );
});

it("hides retry from crew", async () => {
  state.dispatch = { ...sent, status: "FAILED", sentAt: null };
  render("CREW");

  await screen.findByText("Failed to send");
  expect(screen.queryByRole("button", { name: "Retry sending" })).toBeNull();
});

it("links to contractor setup when the chosen type has no contractor", async () => {
  state.role = "MANAGER";
  const root = createRootRoute({
    component: () => (
      <WorkOrderContractorEmail canCreate estateId={estateId} order={order} />
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  renderWithProviders(<RouterProvider router={router} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Email contractor" })
  );
  const dialog = within(await screen.findByRole("dialog"));

  await chooseOption(
    dialog.getByRole("combobox", { name: "Equipment type" }),
    "Lift"
  );

  dialog.getByText("No lift contractor is set up for this estate.");
  expect(
    dialog
      .getByRole("link", { name: "Set up contractors" })
      .getAttribute("href")
  ).toBe(`/estates/${estateId}/contractors`);
});
