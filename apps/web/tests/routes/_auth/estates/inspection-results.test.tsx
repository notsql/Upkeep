import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent } from "@testing-library/react";
import {
  crewEstateAccess,
  ownerEstateAccess,
  unassignedAccess,
} from "@tests/fixtures/access";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";

// These are server-response examples from the plan, not frontend API type declarations.
const estateId = "00000000-0000-0000-0000-000000000001";
const assetId = "00000000-0000-0000-0000-000000000002";
const inspectionId = "00000000-0000-0000-0000-000000000003";
const locationId = "00000000-0000-0000-0000-000000000004";
const workOrderId = "00000000-0000-0000-0000-000000000005";
const assetPath = `/estates/${estateId}/assets/${assetId}`;
const newPath = `${assetPath}/inspections/new`;
const detailPath = `${assetPath}/inspections/${inspectionId}`;
const orderPath = `/estates/${estateId}/work-orders/new`;
const OUTCOME = /^(Pass|Fail)$/;
const NOTES = /notes/i;
const HISTORY = /history/i;
const UNAVAILABLE_INSPECTOR = /inspector unavailable|name unavailable/i;
const MUTATION_ACTION = /edit|delete/i;
const PHOTOS = /photos/i;
const inspection = {
  id: inspectionId,
  estateId,
  assetId,
  locationId,
  locationPath: "Block A / Level 1",
  outcome: "FAIL",
  inspectedOn: "2026-10-26",
  notes: "Cracked seal",
  recordedByUserId: "technician-account-id",
  recordedByName: null,
  createdAt: "2026-10-26T00:30:00Z",
  photos: [],
  workOrder: null,
};
const asset = {
  id: assetId,
  estateId,
  locationId,
  reference: "OAK-A0001",
  name: "Water Pump",
  category: "PUMP",
  locationPath: "Block A / Level 1",
  installedOn: "2020-01-01",
  estateActive: true,
  assetActive: true,
  locationActive: true,
};
const state = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  role: "OWNER",
  result: {} as Record<string, unknown>,
  context: {} as Record<string, unknown>,
  revoked: false,
}));
vi.mock("@/routes/__root", async () => {
  const { createRootRouteWithContext, Outlet } = await import(
    "@tanstack/react-router"
  );
  return {
    Route: createRootRouteWithContext<{ queryClient: QueryClient }>()({
      component: Outlet,
    }),
  };
});
vi.mock("@/lib/api", () => ({ api: { GET: state.get, POST: state.post } }));
vi.mock("@/lib/access-server", () => ({
  getSessionIdentity: async () => ({ id: "tester" }),
  getSessionAccess: async () => ({
    user: { id: "tester" },
    access: (await state.get("/access/context")).data,
  }),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "tester" }, loading: false }),
}));

function access() {
  return {
    ...unassignedAccess,
    canEnterWorkspace: true,
    estates: state.revoked
      ? []
      : [
          {
            ...(state.role === "CREW" ? crewEstateAccess : ownerEstateAccess),
            estateId,
            estateName: "Oak Park",
            canViewManagement: state.role === "OWNER",
            canViewAssets: state.role === "OWNER",
          },
        ],
  };
}

async function setup(path = newPath) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: {
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
    },
    defaultPendingMinMs: 0,
    defaultErrorComponent: () => <p role="alert">Inspection unavailable</p>,
  });
  await router.load();
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

beforeEach(() => {
  state.role = "OWNER";
  state.revoked = false;
  state.result = { ...inspection };
  state.context = { ...asset };
  state.post.mockReset().mockImplementation(() =>
    Promise.resolve({
      data: state.result,
      response: new Response(null, { status: 201 }),
    })
  );
  state.get
    .mockReset()
    .mockImplementation((path: string, options?: unknown) => {
      let data: unknown;
      switch (path) {
        case "/access/context":
          data = access();
          break;
        case "/estates/{estateId}":
          data = {
            id: estateId,
            name: "Oak Park",
            owned: state.role === "OWNER",
          };
          break;
        case "/estates/{estateId}/inspection-assets/{assetId}":
          data = state.context;
          break;
        case "/estates/{estateId}/inspection-assets":
          data = { items: [state.context], nextCursor: null };
          break;
        case "/estates/{estateId}/assets/{assetId}/inspections/{inspectionId}":
          data = state.result;
          break;
        case "/estates/{estateId}/assets/{assetId}/inspections":
          data = { items: [state.result], nextCursor: null };
          break;
        case "/estates/{estateId}/work-order-assets":
          data = { items: [state.context], nextCursor: null };
          break;
        case "/estates/{estateId}/locations":
          data = [
            { id: locationId, name: "Level 1", type: "LEVEL", children: [] },
          ];
          break;
        case "/estates/{estateId}/work-orders/{workOrderId}":
          data = { id: workOrderId, reference: "OAK-W0001", status: "OPEN" };
          break;
        default:
          data =
            path.includes("inspection") &&
            JSON.stringify(options ?? {}).includes(inspectionId)
              ? state.result
              : [];
      }
      return Promise.resolve({ data, response: new Response() });
    });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("defaults the date to Singapore today and requires an explicit outcome", async () => {
  // UTC is still October 25; the Singapore date is already October 26.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T16:30:00Z"));
  await setup();
  const date = (await screen.findByLabelText(
    "Inspection date"
  )) as HTMLInputElement;
  expect(date.value).toBe("2026-10-26");
  expect(
    screen.getByRole("combobox", { name: "Outcome" }).textContent
  ).not.toMatch(OUTCOME);
  fireEvent.click(
    screen.getByRole("button", { name: "Save inspection record" })
  );
  expect(state.post).not.toHaveBeenCalled();
});

it("saves Pass and opens the saved result without a work-order handoff", async () => {
  state.result = { ...inspection, outcome: "PASS", notes: null };
  const { router } = await setup();
  await chooseOption(
    await screen.findByRole("combobox", { name: "Outcome" }),
    "Pass"
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Save inspection record" })
  );
  await waitFor(() => expect(router.state.location.pathname).toBe(detailPath));
  expect(state.post).toHaveBeenCalledWith(
    "/estates/{estateId}/assets/{assetId}/inspections",
    expect.objectContaining({
      params: { path: { estateId, assetId } },
    })
  );
  expect(
    state.post.mock.calls.some(
      ([path]) => path === "/estates/{estateId}/work-orders"
    )
  ).toBe(false);
});

it("invalidates only the saving user's inspection history for the selected asset", async () => {
  state.result = { ...inspection, outcome: "PASS" };
  const view = await setup();
  const history = ["tester", "inspection-results", estateId, assetId, "list"];
  const unrelated = [
    "another-user",
    "inspection-results",
    estateId,
    assetId,
    "list",
  ];
  view.queryClient.setQueryData(history, { items: [], nextCursor: null });
  view.queryClient.setQueryData(unrelated, { items: [], nextCursor: null });
  await chooseOption(
    await screen.findByRole("combobox", { name: "Outcome" }),
    "Pass"
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Save inspection record" })
  );
  await waitFor(() =>
    expect(view.router.state.location.pathname).toBe(detailPath)
  );
  expect(view.queryClient.getQueryState(history)?.isInvalidated).toBe(true);
  expect(view.queryClient.getQueryState(unrelated)?.isInvalidated).toBe(false);
});

it("rejects more than three photos before submission", async () => {
  await setup();
  const input = await screen.findByLabelText(PHOTOS);
  const files = Array.from(
    { length: 4 },
    (_, index) =>
      new File(["image"], `seal-${index}.png`, { type: "image/png" })
  );
  fireEvent.change(input, { target: { files } });
  await screen.findByRole("alert");
  expect(state.post).not.toHaveBeenCalled();
});

it("previews selected photos, removes evidence and submits only the remaining file", async () => {
  const createObjectURL = vi
    .fn()
    .mockReturnValueOnce("blob:first-photo")
    .mockReturnValueOnce("blob:second-photo");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    }
  );
  state.result = { ...inspection, outcome: "PASS" };
  const { router } = await setup();
  const first = new File(["first"], "first.png", { type: "image/png" });
  const second = new File(["second"], "second.jpg", { type: "image/jpeg" });
  fireEvent.change(await screen.findByLabelText(PHOTOS), {
    target: { files: [first, second] },
  });
  expect(
    (
      await screen.findByRole("img", { name: "Selected evidence: first.png" })
    ).getAttribute("src")
  ).toBe("blob:first-photo");
  await screen.findByRole("img", { name: "Selected evidence: second.jpg" });
  fireEvent.click(screen.getByRole("button", { name: "Remove first.png" }));
  expect(
    screen.queryByRole("img", { name: "Selected evidence: first.png" })
  ).toBeNull();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:first-photo");
  await chooseOption(screen.getByRole("combobox", { name: "Outcome" }), "Pass");
  fireEvent.click(
    screen.getByRole("button", { name: "Save inspection record" })
  );
  await waitFor(() => expect(router.state.location.pathname).toBe(detailPath));
  const body = state.post.mock.calls[0][1].body as FormData;
  expect(body.getAll("photos")).toEqual([second]);
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:second-photo");
});

it("requires explicit confirmation of a refreshed location and preserves edits on retry", async () => {
  const updatedLocationId = "00000000-0000-0000-0000-000000000006";
  state.result = { ...inspection, outcome: "PASS" };
  state.post.mockResolvedValueOnce({
    error: { message: "Asset location changed. Refresh and review." },
    response: new Response(null, { status: 409 }),
  });
  const { router } = await setup();
  await chooseOption(
    await screen.findByRole("combobox", { name: "Outcome" }),
    "Pass"
  );
  fireEvent.change(screen.getByRole("textbox", { name: NOTES }), {
    target: { value: "Keep these notes" },
  });
  fireEvent.change(screen.getByLabelText("Inspection date"), {
    target: { value: "2026-10-01" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save inspection record" })
  );
  await screen.findByRole("alert");
  const firstBody = state.post.mock.calls[0][1].body as FormData;
  expect(firstBody.get("expectedLocationId")).toBe(locationId);
  state.context = {
    ...asset,
    locationId: updatedLocationId,
    locationPath: "Block B / Level 2",
  };
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh asset location" })
  );
  const confirm = await screen.findByRole("button", {
    name: "Use updated asset location",
  });
  screen.getByText(
    "Recorded location: Block A / Level 1. Current location: Block B / Level 2. Review the change before continuing."
  );
  const save = screen.getByRole("button", { name: "Save inspection record" });
  expect(save.hasAttribute("disabled")).toBe(true);
  fireEvent.click(save);
  expect(state.post).toHaveBeenCalledTimes(1);
  fireEvent.click(confirm);
  expect(save.hasAttribute("disabled")).toBe(false);
  fireEvent.click(save);
  await waitFor(() => expect(router.state.location.pathname).toBe(detailPath));
  expect(state.post).toHaveBeenCalledTimes(2);
  const retryBody = state.post.mock.calls[1][1].body as FormData;
  expect(retryBody.get("expectedLocationId")).toBe(updatedLocationId);
  expect(retryBody.get("outcome")).toBe("PASS");
  expect(retryBody.get("inspectedOn")).toBe("2026-10-01");
  expect(retryBody.get("notes")).toBe("Keep these notes");
});

it("offers the saved record without resubmission when navigation fails after saving", async () => {
  const { router } = await setup();
  await chooseOption(
    await screen.findByRole("combobox", { name: "Outcome" }),
    "Fail"
  );
  vi.spyOn(router, "navigate").mockRejectedValue(
    new Error("Navigation failed")
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Save inspection record" })
  );
  await screen.findByRole("heading", { name: "Inspection saved" });
  expect((await screen.findByRole("alert")).textContent).toBe(
    "The inspection was saved. Open the saved record to continue."
  );
  expect(
    screen
      .getByRole("link", { name: "View saved inspection" })
      .getAttribute("href")
  ).toBe(detailPath);
  expect(
    screen.queryByRole("button", { name: "Save inspection record" })
  ).toBeNull();
  expect(state.post).toHaveBeenCalledTimes(1);
});

it("hides a cached result immediately when estate access is revoked", async () => {
  const view = await setup(detailPath);
  await screen.findByText("Cracked seal");
  state.revoked = true;
  await view.queryClient.invalidateQueries({
    queryKey: ["tester", "app-access"],
  });
  await waitFor(() => expect(screen.queryByText("Cracked seal")).toBeNull());
  expect(screen.queryByRole("link", { name: "Create work order" })).toBeNull();
});

it.each(["OWNER", "MANAGER"])(
  "saves Fail before opening the prefilled work-order form as %s",
  async (role) => {
    state.role = role;
    const { router } = await setup();
    await chooseOption(
      await screen.findByRole("combobox", { name: "Outcome" }),
      "Fail"
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save inspection record" })
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(orderPath);
      expect(router.state.location.search).toEqual({
        sourceInspectionId: inspectionId,
      });
    });
    expect(state.post).toHaveBeenCalledTimes(1);
    expect(state.post.mock.calls[0][0]).toBe(
      "/estates/{estateId}/assets/{assetId}/inspections"
    );
  }
);

it("saves a Crew Fail and returns to history without offering work-order creation", async () => {
  state.role = "CREW";
  const { router } = await setup();
  await chooseOption(
    await screen.findByRole("combobox", { name: "Outcome" }),
    "Fail"
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Save inspection record" })
  );
  await waitFor(() => expect(router.state.location.pathname).toBe(assetPath));
  const table = await screen.findByRole("table", {
    name: "Inspection records",
  });
  within(table).getByText("Fail");
  expect(screen.queryByRole("link", { name: "Create work order" })).toBeNull();
  expect(state.post).toHaveBeenCalledTimes(1);
  fireEvent.click(within(table).getByRole("link", { name: "View record" }));
  await waitFor(() => expect(router.state.location.pathname).toBe(detailPath));
  expect(screen.queryByRole("link", { name: "Create work order" })).toBeNull();
});

it.each([
  orderPath,
  `${orderPath}?sourceInspectionId=${inspectionId}`,
  `${orderPath}?sourceReportId=${inspectionId}`,
])("denies a Crew direct creation URL: %s", async (path) => {
  state.role = "CREW";
  await setup(path);
  await screen.findByText("Not Found");
  expect(screen.queryByRole("textbox", { name: "Description" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Create work order" })
  ).toBeNull();
  expect(state.post).not.toHaveBeenCalled();
});

it.each([409, 503])(
  "retains entered values after a save fails with %s",
  async (status) => {
    state.post.mockResolvedValue({
      error: { message: "Refresh and review before retrying." },
      response: new Response(null, { status }),
    });
    await setup();
    await chooseOption(
      await screen.findByRole("combobox", { name: "Outcome" }),
      "Fail"
    );
    fireEvent.change(screen.getByRole("textbox", { name: NOTES }), {
      target: { value: "Keep these notes" },
    });
    fireEvent.change(screen.getByLabelText("Inspection date"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save inspection record" })
    );
    await screen.findByRole("alert");
    expect(
      (screen.getByRole("textbox", { name: NOTES }) as HTMLTextAreaElement)
        .value
    ).toBe("Keep these notes");
    expect(
      (screen.getByLabelText("Inspection date") as HTMLInputElement).value
    ).toBe("2026-10-01");
    expect(
      screen.getByRole("combobox", { name: "Outcome" }).textContent
    ).toContain("Fail");
  }
);

it("prevents duplicate clicks while a save is pending", async () => {
  state.post.mockReturnValue(new Promise(() => undefined));
  await setup();
  await chooseOption(
    await screen.findByRole("combobox", { name: "Outcome" }),
    "Pass"
  );
  const button = screen.getByRole("button", { name: "Save inspection record" });
  fireEvent.click(button);
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(true));
  fireEvent.click(button);
  expect(state.post).toHaveBeenCalledTimes(1);
});

it("offers history checking after an ambiguous save without automatically retrying", async () => {
  state.post.mockRejectedValue(new Error("Network interrupted"));
  await setup();
  await chooseOption(
    await screen.findByRole("combobox", { name: "Outcome" }),
    "Fail"
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Save inspection record" })
  );
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toMatch(HISTORY);
  expect(state.post).toHaveBeenCalledTimes(1);
});

it.each(["MANAGER", "CREW"])(
  "renders restricted asset context for %s without requesting owner-only data",
  async (role) => {
    state.role = role;
    await setup(assetPath);
    await screen.findByRole("heading", { name: "Water Pump" });
    screen.getByRole("link", { name: "Create inspection record" });
    expect(screen.queryByRole("link", { name: "Edit asset" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retire asset" })).toBeNull();
    expect(
      state.get.mock.calls.some(([path]) =>
        [
          "/estates/{estateId}/assets/{id}",
          "/estates/{estateId}/assets/{assetId}/assessments",
          "/estates/{estateId}/assets/{assetId}/events",
          "/estates/{estateId}/assets/{assetId}/failure-risk",
        ].includes(path)
      )
    ).toBe(false);
  }
);

it("shows a persistent failure and a resumption action after cancellation or refresh", async () => {
  await setup(detailPath);
  await screen.findByText("Awaiting work order");
  const action = screen.getByRole("link", { name: "Create work order" });
  expect(action.getAttribute("href")).toBe(
    `${orderPath}?sourceInspectionId=${inspectionId}`
  );
  screen.getByText("Cracked seal");
  expect(state.post).not.toHaveBeenCalled();
});

it("shows an unavailable inspector name without displaying the account identifier", async () => {
  await setup(detailPath);
  await screen.findByText(UNAVAILABLE_INSPECTOR);
  expect(screen.queryByText("technician-account-id")).toBeNull();
});

it("links an existing work order and never offers fresh conversion for a linked source", async () => {
  state.result = {
    ...inspection,
    workOrder: { id: workOrderId, reference: "OAK-W0001" },
  };
  await setup(detailPath);
  const link = await screen.findByRole("link", { name: "OAK-W0001" });
  expect(link.getAttribute("href")).toBe(
    `/estates/${estateId}/work-orders/${workOrderId}`
  );
  expect(screen.queryByRole("link", { name: "Create work order" })).toBeNull();
  expect(screen.queryByText("Awaiting work order")).toBeNull();
});

it("offers no conversion for Pass and no editing or deletion of a saved result", async () => {
  state.result = { ...inspection, outcome: "PASS" };
  await setup(detailPath);
  await screen.findByText("Pass");
  expect(screen.queryByRole("link", { name: "Create work order" })).toBeNull();
  expect(screen.queryByRole("button", { name: MUTATION_ACTION })).toBeNull();
  expect(screen.queryByRole("link", { name: MUTATION_ACTION })).toBeNull();
});

it("loads an inspection source from the server and prefills the description once", async () => {
  const view = await setup(`${orderPath}?sourceInspectionId=${inspectionId}`);
  const description = (await screen.findByRole("textbox", {
    name: "Description",
  })) as HTMLTextAreaElement;
  await waitFor(() => expect(description.value).toBe("Cracked seal"));
  fireEvent.change(description, { target: { value: "Technician edits" } });
  state.result = { ...inspection, notes: "Refetched notes" };
  await view.queryClient.invalidateQueries();
  expect(description.value).toBe("Technician edits");
  expect(
    screen.queryByRole("button", { name: "Remove linked asset" })
  ).toBeNull();
  expect(
    state.get.mock.calls.some(
      ([path, options]) =>
        path.includes("inspection") &&
        JSON.stringify(options).includes(inspectionId)
    )
  ).toBe(true);
});

it("creates inspection follow-up with edited details and forces Safety to Urgent", async () => {
  const { router } = await setup(
    `${orderPath}?sourceInspectionId=${inspectionId}`
  );
  const description = await screen.findByRole("textbox", {
    name: "Description",
  });
  fireEvent.change(description, {
    target: { value: "  Replace unsafe seal  " },
  });
  await chooseOption(
    screen.getByRole("combobox", { name: "Category" }),
    "Safety"
  );
  const priority = screen.getByRole("combobox", { name: "Priority" });
  expect(priority.textContent).toContain("Urgent");
  expect(priority.hasAttribute("disabled")).toBe(true);
  const source = screen.getByRole("combobox", { name: "Source" });
  expect(source.textContent).toContain("Inspection");
  expect(source.hasAttribute("disabled")).toBe(true);
  const location = screen.getByRole("combobox", { name: "Location" });
  expect(location.textContent).toContain("Block A / Level 1");
  expect(location.hasAttribute("disabled")).toBe(true);
  expect(
    screen.queryByRole("textbox", { name: "Source reference or explanation" })
  ).toBeNull();
  expect(
    screen.queryByRole("region", { name: "Source inspection" })
  ).toBeNull();
  expect(screen.queryByText("Recorded inspection location")).toBeNull();
  expect(screen.queryByText("Current work location")).toBeNull();
  expect(screen.queryByRole("link", { name: "Back to inspection" })).toBeNull();
  const navigate = vi.spyOn(router, "navigate").mockResolvedValue(undefined);
  state.post.mockResolvedValueOnce({
    data: { id: workOrderId },
    response: new Response(null, { status: 201 }),
  });
  fireEvent.click(screen.getByRole("button", { name: "Create work order" }));
  await waitFor(() =>
    expect(state.post).toHaveBeenCalledWith(
      "/estates/{estateId}/work-orders",
      expect.objectContaining({
        params: { path: { estateId } },
        body: {
          description: "Replace unsafe seal",
          category: "SAFETY",
          priority: "URGENT",
          source: "INSPECTION",
          sourceInspectionId: inspectionId,
          assetId,
          locationId,
          expectedSourceLocationId: locationId,
        },
      })
    )
  );
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({
      to: "/estates/$estateId/work-orders/$workOrderId",
      params: { estateId, workOrderId },
    })
  );
});

it("opens the existing work-order form after a Fail and can cancel and reopen it from inspection history", async () => {
  state.role = "MANAGER";
  const { router } = await setup();
  await chooseOption(
    await screen.findByRole("combobox", { name: "Outcome" }),
    "Fail"
  );
  fireEvent.change(screen.getByRole("textbox", { name: NOTES }), {
    target: { value: "Cracked seal" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save inspection record" })
  );
  await waitFor(() => expect(router.state.location.pathname).toBe(orderPath));
  const description = (await screen.findByRole("textbox", {
    name: "Description",
  })) as HTMLTextAreaElement;
  await waitFor(() => expect(description.value).toBe("Cracked seal"));
  const source = screen.getByRole("combobox", { name: "Source" });
  expect(source.textContent).toContain("Inspection");
  expect(source.hasAttribute("disabled")).toBe(true);
  const location = screen.getByRole("combobox", { name: "Location" });
  expect(location.textContent).toContain("Block A / Level 1");
  expect(location.hasAttribute("disabled")).toBe(true);
  const linkedAsset = screen.getByRole("button", { name: "Linked asset" });
  expect(linkedAsset.textContent).toContain("OAK-A0001");
  expect(linkedAsset.textContent).toContain("Water Pump");
  expect(linkedAsset.hasAttribute("disabled")).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Remove linked asset" })
  ).toBeNull();
  expect(
    state.get.mock.calls.some(
      ([path]) => path === "/estates/{estateId}/locations"
    )
  ).toBe(false);
  fireEvent.change(description, {
    target: { value: "Unsaved work-order draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(router.state.location.pathname).toBe(assetPath));
  const table = await screen.findByRole("table", {
    name: "Inspection records",
  });
  within(table).getByText("Fail");
  expect(within(table).queryByText("Awaiting work order")).toBeNull();
  const recreate = within(table).getByRole("link", {
    name: "Create work order",
  });
  expect(recreate.getAttribute("href")).toBe(
    `${orderPath}?sourceInspectionId=${inspectionId}`
  );
  expect(state.post).toHaveBeenCalledTimes(1);
  fireEvent.click(recreate);
  const reopened = (await screen.findByRole("textbox", {
    name: "Description",
  })) as HTMLTextAreaElement;
  await waitFor(() => expect(reopened.value).toBe("Cracked seal"));
  expect(router.state.location.search).toEqual({
    sourceInspectionId: inspectionId,
  });
  expect(state.post).toHaveBeenCalledTimes(1);
});

it("reviews moved inspection assets before creation and preserves edits through a later conflict", async () => {
  const movedLocationId = "00000000-0000-0000-0000-000000000006";
  const latestLocationId = "00000000-0000-0000-0000-000000000007";
  state.context = {
    ...asset,
    locationId: movedLocationId,
    locationPath: "Block B / Level 2",
  };
  const { router } = await setup(
    `${orderPath}?sourceInspectionId=${inspectionId}`
  );
  const description = await screen.findByRole("textbox", {
    name: "Description",
  });
  fireEvent.change(description, { target: { value: "Keep technician edits" } });
  const create = screen.getByRole("button", { name: "Create work order" });
  expect(create.hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")
  ).toBe(false);
  expect(
    screen.getByRole("combobox", { name: "Location" }).textContent
  ).toContain("Block B / Level 2");
  screen.getByText("Block A / Level 1");
  fireEvent.click(
    screen.getByRole("button", { name: "Use current asset location" })
  );
  state.post.mockResolvedValueOnce({
    error: { message: "Asset location changed again." },
    response: new Response(null, { status: 409 }),
  });
  fireEvent.click(create);
  await screen.findByRole("alert");
  expect(create.hasAttribute("disabled")).toBe(true);
  state.context = {
    ...asset,
    locationId: latestLocationId,
    locationPath: "Block C / Level 3",
  };
  fireEvent.click(screen.getByRole("button", { name: "Reload source" }));
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", { name: "Location" }).textContent
    ).toContain("Block C / Level 3")
  );
  expect(create.hasAttribute("disabled")).toBe(true);
  expect((description as HTMLTextAreaElement).value).toBe(
    "Keep technician edits"
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Use current asset location" })
  );
  vi.spyOn(router, "navigate").mockResolvedValue(undefined);
  state.post.mockResolvedValueOnce({
    data: { id: workOrderId },
    response: new Response(null, { status: 201 }),
  });
  fireEvent.click(create);
  await waitFor(() =>
    expect(state.post).toHaveBeenLastCalledWith(
      "/estates/{estateId}/work-orders",
      expect.objectContaining({
        body: expect.objectContaining({
          description: "Keep technician edits",
          source: "INSPECTION",
          sourceInspectionId: inspectionId,
          assetId,
          locationId: latestLocationId,
          expectedSourceLocationId: latestLocationId,
        }),
      })
    )
  );
});

it.each([
  { ...inspection, outcome: "PASS" },
  { ...inspection, workOrder: { id: workOrderId, reference: "OAK-W0001" } },
])(
  "does not create another work order for an ineligible saved inspection: %j",
  async (record) => {
    state.result = record;
    await setup(`${orderPath}?sourceInspectionId=${inspectionId}`);
    await screen.findByRole("link", { name: "Back to inspection" });
    expect(
      screen.queryByRole("button", { name: "Create work order" })
    ).toBeNull();
    expect(state.post).not.toHaveBeenCalled();
  }
);

it.each([
  "sourceInspectionId=forged",
  `sourceInspectionId=${inspectionId}&sourceReportId=${workOrderId}`,
])("rejects invalid or mixed source query parameters: %s", async (search) => {
  await setup(`${orderPath}?${search}`);
  await screen.findByRole("alert");
  expect(state.post).not.toHaveBeenCalled();
  // Reject the URL before reading either source; a failed report query must not make this test pass.
  expect(
    state.get.mock.calls.some(
      ([path]) =>
        path === "/estates/{estateId}/reports/{reportId}" ||
        path.includes("/inspections/")
    )
  ).toBe(false);
  expect(
    screen.queryByRole("button", { name: "Create work order" })
  ).toBeNull();
});
