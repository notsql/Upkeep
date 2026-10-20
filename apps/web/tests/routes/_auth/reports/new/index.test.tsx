import { fireEvent } from "@testing-library/react";
import {
  mixedAccess,
  residentAccess,
  unassignedAccess,
} from "@tests/fixtures/access";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/_auth/reports/new";

const { get, post, navigate, auth } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  navigate: vi.fn(),
  auth: { user: { id: "resident-a" }, role: "user", loading: false },
}));
const REPORT_A_FAULT = /Report a fault/i;
const SUBMIT_REPORT = /Submit report/i;
const BLOCK = /Block/i;
const LEVEL = /Level/i;
const DESCRIPTION = /Description/i;
const TITLE = /^Title$/;
const NO_ESTATE_ASSIGNED = /no estate assigned/i;
const IMAGES = /Images/i;
const IMAGE_PICKERS = /Images \(optional\)|Take photo/;
const REMOVE_FAULT_IMAGE = /Remove fault.png/i;
const ESTATE = /estate/i;
vi.mock("@/lib/api", () => ({ api: { GET: get, POST: post } }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => auth,
}));

const Page = Route.options.component as React.ComponentType;
const estateId = "00000000-0000-0000-0000-000000000001";
const blockId = "00000000-0000-0000-0000-000000000002";
const levelId = "00000000-0000-0000-0000-000000000003";

beforeEach(() => {
  auth.role = "user";
  get.mockReset();
  post.mockReset();
  post.mockResolvedValue({
    data: { id: "00000000-0000-0000-0000-000000000010" },
  });
  navigate.mockReset();
  get.mockImplementation((path: string) => {
    if (path === "/access/context") {
      return Promise.resolve({
        data: {
          ...residentAccess,
          residentEstate: { id: estateId, name: "Maple Estate" },
          estates: [{ ...residentAccess.estates[0], estateId }],
        },
      });
    }
    if (path === "/resident/context") {
      return Promise.resolve({
        data: {
          estates: [{ id: estateId, name: "Maple Estate" }],
          canSubmit: true,
        },
      });
    }
    if (path === "/resident/locations") {
      return Promise.resolve({
        data: [
          {
            id: blockId,
            type: "BLOCK",
            name: "Block A",
            parentId: null,
            sortOrder: 1,
          },
          {
            id: levelId,
            type: "LEVEL",
            name: "Level 2",
            parentId: blockId,
            sortOrder: 2,
          },
        ],
      });
    }
    return Promise.resolve({ error: { message: "Unexpected request" } });
  });
});

it("shows only the assigned estate and requires description and a level or common area", async () => {
  renderWithProviders(<Page />);
  await screen.findByRole("heading", { name: REPORT_A_FAULT });
  await screen.findByText("Maple Estate");
  expect(screen.queryByText("Road")).toBeNull();
  const submit = screen.getByRole("button", { name: SUBMIT_REPORT });
  fireEvent.click(submit);
  expect(post).not.toHaveBeenCalled();

  await chooseOption(screen.getByRole("combobox", { name: BLOCK }), "Block A");
  fireEvent.change(screen.getByRole("textbox", { name: DESCRIPTION }), {
    target: { value: "Leaking pipe" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: TITLE }), {
    target: { value: "  Leaking pipe  " },
  });
  fireEvent.click(submit);
  expect(post).not.toHaveBeenCalled();
  await chooseOption(screen.getByRole("combobox", { name: LEVEL }), "Level 2");
  fireEvent.click(submit);
  await waitFor(() => expect(post).toHaveBeenCalled());
  const body = post.mock.calls[0][1].body as FormData;
  expect(body.get("description")).toBe("Leaking pipe");
  expect(body.get("title")).toBe("Leaking pipe");
  expect(body.get("locationId")).toBe(levelId);
  expect(body.get("estateId")).toBe(estateId);
  await waitFor(() => expect(navigate).toHaveBeenCalled());
});

it("explains missing assignment and prevents submission", async () => {
  get.mockImplementation((path: string) => {
    const responses: Record<string, unknown> = {
      "/access/context": unassignedAccess,
      "/resident/context": { estates: [], canSubmit: false },
      "/resident/locations": [],
    };
    return Promise.resolve({ data: responses[path] });
  });
  renderWithProviders(<Page />);
  await screen.findByText(NO_ESTATE_ASSIGNED);
  expect(screen.queryByRole("button", { name: SUBMIT_REPORT })).toBeNull();
  expect(post).not.toHaveBeenCalled();
});

it("reports only in the resident estate even when the account manages another estate", async () => {
  const original = get.getMockImplementation();
  get.mockImplementation((path: string) =>
    path === "/access/context"
      ? Promise.resolve({
          data: {
            ...mixedAccess,
            residentEstate: { id: estateId, name: "Maple Estate" },
            estates: [
              { ...residentAccess.estates[0], estateId },
              ...mixedAccess.estates.slice(1),
            ],
          },
        })
      : original?.(path)
  );
  renderWithProviders(<Page />);
  await screen.findByText("Maple Estate");
  expect(screen.queryByRole("combobox", { name: ESTATE })).toBeNull();
  expect(screen.queryByText("Oak Park")).toBeNull();
  await chooseOption(
    await screen.findByRole("combobox", { name: BLOCK }),
    "Block A"
  );
  await chooseOption(screen.getByRole("combobox", { name: LEVEL }), "Level 2");
  fireEvent.change(screen.getByRole("textbox", { name: DESCRIPTION }), {
    target: { value: "Fault in my resident estate" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: TITLE }), {
    target: { value: "Fault title" },
  });
  fireEvent.click(screen.getByRole("button", { name: SUBMIT_REPORT }));
  await waitFor(() => expect(post).toHaveBeenCalled());
  expect((post.mock.calls[0][1].body as FormData).get("locationId")).toBe(
    levelId
  );
});

it("keeps entered text and selected location after an upload failure", async () => {
  post.mockResolvedValue({
    error: { message: "Storage unavailable" },
    response: new Response(null, { status: 503 }),
  });
  renderWithProviders(<Page />);
  await screen.findByRole("heading", { name: REPORT_A_FAULT });
  await chooseOption(screen.getByRole("combobox", { name: BLOCK }), "Block A");
  await chooseOption(screen.getByRole("combobox", { name: LEVEL }), "Level 2");
  const description = screen.getByRole("textbox", {
    name: DESCRIPTION,
  }) as HTMLTextAreaElement;
  fireEvent.change(description, { target: { value: "Leaking pipe" } });
  const title = screen.getByRole("textbox", {
    name: TITLE,
  }) as HTMLInputElement;
  fireEvent.change(title, { target: { value: "Leaking pipe title" } });
  fireEvent.click(screen.getByRole("button", { name: SUBMIT_REPORT }));

  await screen.findByRole("alert");
  expect(description.value).toBe("Leaking pipe");
  expect(title.value).toBe("Leaking pipe title");
  expect(screen.getByRole("combobox", { name: LEVEL }).textContent).toContain(
    "Level 2"
  );
  expect(navigate).not.toHaveBeenCalled();
  expect(post).toHaveBeenCalledTimes(1);
});

it("lets a resident remove a selected photo before submitting", async () => {
  renderWithProviders(<Page />);
  await screen.findByRole("heading", { name: REPORT_A_FAULT });
  const input = screen.getByLabelText(IMAGES) as HTMLInputElement;
  expect(input.accept).toContain("image/");
  fireEvent.change(input, {
    target: {
      files: [new File(["photo"], "fault.png", { type: "image/png" })],
    },
  });
  await screen.findByText("fault.png");
  fireEvent.click(screen.getByRole("button", { name: REMOVE_FAULT_IMAGE }));
  expect(screen.queryByText("fault.png")).toBeNull();
});

it("offers one image picker for the gallery or the device's camera chooser", async () => {
  renderWithProviders(<Page />);
  await screen.findByRole("heading", { name: REPORT_A_FAULT });
  const inputs = screen.getAllByLabelText(IMAGE_PICKERS);
  expect(inputs).toHaveLength(1);
  const input = inputs[0] as HTMLInputElement;
  expect(input.type).toBe("file");
  expect(input.accept).toBe("image/*");
  expect(input.multiple).toBe(true);
  expect(input.hasAttribute("capture")).toBe(false);
});

it("adds gallery selections and subsequent camera photos through the same picker", async () => {
  renderWithProviders(<Page />);
  await screen.findByRole("heading", { name: REPORT_A_FAULT });
  await chooseOption(screen.getByRole("combobox", { name: BLOCK }), "Block A");
  await chooseOption(screen.getByRole("combobox", { name: LEVEL }), "Level 2");
  fireEvent.change(screen.getByRole("textbox", { name: DESCRIPTION }), {
    target: { value: "Leaking pipe" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: TITLE }), {
    target: { value: "Fault title" },
  });
  const input = screen.getByLabelText(IMAGES);
  const gallery = new File(["gallery"], "gallery.png", { type: "image/png" });
  const camera = new File(["camera"], "camera.jpg", { type: "image/jpeg" });
  fireEvent.change(input, { target: { files: [gallery] } });
  fireEvent.change(input, { target: { files: [camera] } });
  fireEvent.click(screen.getByRole("button", { name: SUBMIT_REPORT }));
  await waitFor(() => expect(post).toHaveBeenCalled());
  const body = post.mock.calls[0][1].body as FormData;
  expect(body.getAll("images")).toEqual([gallery, camera]);
});

it("requires a nonblank title of at most 50 characters before submitting", async () => {
  renderWithProviders(<Page />);
  await screen.findByRole("heading", { name: REPORT_A_FAULT });
  await chooseOption(screen.getByRole("combobox", { name: BLOCK }), "Block A");
  await chooseOption(screen.getByRole("combobox", { name: LEVEL }), "Level 2");
  fireEvent.change(screen.getByRole("textbox", { name: DESCRIPTION }), {
    target: { value: "Water pooling near the lift" },
  });
  const title = screen.getByRole("textbox", {
    name: TITLE,
  }) as HTMLInputElement;
  expect(title.maxLength).toBe(50);
  screen.getByText("Give the fault a short title in up to 50 characters.");
  for (const invalid of ["", "   ", "x".repeat(51)]) {
    fireEvent.change(title, { target: { value: invalid } });
    fireEvent.click(screen.getByRole("button", { name: SUBMIT_REPORT }));
    expect(post).not.toHaveBeenCalled();
    screen.getByRole("alert");
  }
  fireEvent.change(title, { target: { value: `  ${"x".repeat(50)}  ` } });
  fireEvent.click(screen.getByRole("button", { name: SUBMIT_REPORT }));
  await waitFor(() => expect(post).toHaveBeenCalled());
  expect((post.mock.calls[0][1].body as FormData).get("title")).toBe(
    "x".repeat(50)
  );
});

it("lets a multi-estate resident choose an estate and clears the old location selection", async () => {
  const original = get.getMockImplementation();
  get.mockImplementation((path: string, options?: unknown) =>
    path === "/resident/context"
      ? Promise.resolve({
          data: {
            estates: [
              { id: estateId, name: "Maple Estate" },
              { id: "other", name: "Other Estate" },
            ],
            canSubmit: true,
          },
        })
      : original?.(path, options)
  );
  renderWithProviders(<Page />);
  await chooseOption(
    await screen.findByRole("combobox", { name: "Estate" }),
    "Maple Estate"
  );
  await chooseOption(screen.getByRole("combobox", { name: BLOCK }), "Block A");
  await chooseOption(screen.getByRole("combobox", { name: LEVEL }), "Level 2");
  await chooseOption(
    screen.getByRole("combobox", { name: "Estate" }),
    "Other Estate"
  );
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith("/resident/locations", {
      params: { query: { estateId: "other" } },
    })
  );
  expect(
    screen.getByRole("combobox", { name: LEVEL }).textContent
  ).not.toContain("Level 2");
  expect(post).not.toHaveBeenCalled();
});
