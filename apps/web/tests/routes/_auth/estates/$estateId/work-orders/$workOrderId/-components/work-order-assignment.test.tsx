import type { components } from "@proj/api/schema";
import { fireEvent } from "@testing-library/react";
import {
  crewEstateAccess,
  ownerEstateAccess,
  workspaceAccess,
} from "@tests/fixtures/access";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkOrderAssignment } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-assignment";

const PRIYA = /Priya Tan/u;
const ACE = /Ace Plumbing/u;

const { get, put, del, post, state } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  post: vi.fn(),
  state: { role: "MANAGER", dispatch: null as unknown },
}));
vi.mock("@/lib/api", () => ({
  api: { GET: get, PUT: put, DELETE: del, POST: post },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "manager" }, loading: false }),
}));

type WorkOrder = components["schemas"]["WorkOrderResponse"];
const estateId = "estate";
const timestamp = "2026-10-01T00:00:00Z";
const order = {
  id: "order",
  status: "OPEN",
  version: 3,
  assignee: null,
  canProgress: true,
} as unknown as WorkOrder;
const ace = {
  kind: "CONTRACTOR",
  id: "ace",
  name: "Ace Plumbing",
  email: "jobs@ace.example",
  assignedAt: timestamp,
  inEstate: true,
} as const;

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
  if (path === "/estates/{estateId}/work-orders/assignees") {
    return Promise.resolve({
      data: {
        members: [
          { userId: "priya", name: "Priya Tan", role: "CREW" },
          { userId: "mia", name: "Mia Lim", role: "MANAGER" },
        ],
        contractors: [
          { id: "ace", name: "Ace Plumbing", email: "jobs@ace.example" },
        ],
      },
    });
  }
  if (path === "/estates/{estateId}/work-orders/{workOrderId}/dispatch") {
    return Promise.resolve({ data: { dispatch: state.dispatch } });
  }
  return Promise.resolve({ data: [] });
}

function render(role: string, target: WorkOrder = order) {
  state.role = role;
  return renderWithProviders(
    <WorkOrderAssignment
      canAssign={role === "MANAGER"}
      estateId={estateId}
      order={target}
    />
  );
}

beforeEach(() => {
  state.dispatch = null;
  get.mockReset().mockImplementation(serve);
  put.mockReset().mockResolvedValue({ data: { ...order, assignee: ace } });
  del.mockReset().mockResolvedValue({ data: order });
  post.mockReset().mockResolvedValue({ data: {} });
});

it("says nobody has the job yet", () => {
  render("CREW");

  screen.getByText("Nobody yet");
  expect(screen.queryByRole("button", { name: "Assign" })).toBeNull();
});

it("lets a manager search the team and contractors and give the job to a contractor", async () => {
  render("MANAGER");

  fireEvent.click(screen.getByRole("button", { name: "Assign" }));
  const search = await screen.findByPlaceholderText("Search by name or email");
  screen.getByText("Who should do this job?");
  await screen.findByText("Your team");
  screen.getByText("Contractors");
  fireEvent.change(search, { target: { value: "ace.example" } });
  await waitFor(() =>
    expect(screen.queryByRole("option", { name: PRIYA })).toBeNull()
  );
  fireEvent.click(screen.getByRole("option", { name: ACE }));
  await screen.findByText("We'll email Ace Plumbing the job details.");
  fireEvent.click(screen.getByRole("button", { name: "Give job" }));

  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      "/estates/{estateId}/work-orders/{workOrderId}/assignee",
      {
        params: { path: { estateId, workOrderId: "order" } },
        body: { providerId: "ace", version: 3 },
      }
    )
  );
});

it("tells the manager a team member will see it in their notifications", async () => {
  render("MANAGER");

  fireEvent.click(screen.getByRole("button", { name: "Assign" }));
  fireEvent.click(await screen.findByRole("option", { name: PRIYA }));
  await screen.findByText("Priya will see this in their notifications.");
  fireEvent.click(screen.getByRole("button", { name: "Give job" }));

  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      "/estates/{estateId}/work-orders/{workOrderId}/assignee",
      expect.objectContaining({ body: { userId: "priya", version: 3 } })
    )
  );
});

it("shows the contractor, the email status and lets a manager change or remove them", async () => {
  state.dispatch = {
    contractorName: "Ace Plumbing",
    contractorEmail: "jobs@ace.example",
    status: "SENT",
    sentAt: timestamp,
    createdAt: timestamp,
    approval: "MANAGER",
    equipmentType: null,
  };
  render("MANAGER", {
    ...order,
    status: "ASSIGNED",
    assignee: ace,
  } as WorkOrder);

  screen.getByText("Ace Plumbing");
  await screen.findByText("Email sent");
  screen.getByRole("button", { name: "Change" });
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));

  await waitFor(() =>
    expect(del).toHaveBeenCalledWith(
      "/estates/{estateId}/work-orders/{workOrderId}/assignee",
      {
        params: {
          path: { estateId, workOrderId: "order" },
          query: { version: 3 },
        },
      }
    )
  );
});

it("lets a manager try again when the email didn't go through", async () => {
  state.dispatch = {
    contractorName: "Ace Plumbing",
    contractorEmail: "jobs@ace.example",
    status: "FAILED",
    sentAt: null,
    createdAt: timestamp,
    approval: "MANAGER",
    equipmentType: null,
  };
  render("MANAGER", {
    ...order,
    status: "ASSIGNED",
    assignee: ace,
  } as WorkOrder);

  fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
  screen.getByText("Email didn't go through");

  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      "/estates/{estateId}/work-orders/{workOrderId}/dispatch/retry",
      { params: { path: { estateId, workOrderId: "order" } } }
    )
  );
});

it("marks a member who has left the estate", () => {
  render("CREW", {
    ...order,
    status: "ASSIGNED",
    assignee: {
      ...ace,
      kind: "MEMBER",
      id: "priya",
      name: "Priya Tan",
      email: null,
      inEstate: false,
    },
  } as WorkOrder);

  screen.getByText("Priya Tan (no longer in this estate)");
});

it("offers no changes on a closed order", () => {
  render("MANAGER", { ...order, status: "CLOSED", assignee: ace } as WorkOrder);

  expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
});
