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
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/_auth/reports/new";
import { NewReportPage } from "@/routes/_auth/reports/new/-components/new-report-page/new-report-page";

const { get, post, navigate, auth } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  navigate: vi.fn(),
  auth: { user: { id: "resident-a" }, role: "user", loading: false },
}));
const REPORT_A_FAULT = /Report a fault/iu;
const SUBMIT_REPORT = /Submit report/iu;
const BLOCK = /Block/iu;
const LEVEL = /Level/iu;
const DESCRIPTION = /Description/iu;
const TITLE = /^Title$/u;
const NO_ESTATE_ASSIGNED = /no estate assigned/iu;
const IMAGES = /Images/iu;
const IMAGE_PICKERS = /Images \(optional\)|Take photo/u;
const REMOVE_FAULT_IMAGE = /Remove fault.png/iu;
vi.mock("@/lib/api", () => ({ api: { GET: get, POST: post } }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({
    children,
    to,
    search,
  }: {
    children: React.ReactNode;
    to: string;
    search?: { estateId?: string };
  }) => (
    <a href={search?.estateId ? `${to}?estateId=${search.estateId}` : to}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => auth,
}));

const Page = Route.options.component as React.ComponentType;
const estateId = "00000000-0000-0000-0000-000000000001";
const blockId = "00000000-0000-0000-0000-000000000002";
const levelId = "00000000-0000-0000-0000-000000000003";

/** The JSON body of the final "submit report" call. */
function createBody(): Record<string, unknown> {
  const call = post.mock.calls.find(([path]) => path === "/resident/reports");
  if (!call) {
    throw new Error("The report was not submitted");
  }
  return call[1].body;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.spyOn(Route, "useSearch").mockReturnValue({});
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

it("uses the estate selected through context navigation instead of silently choosing another", async () => {
  const original = get.getMockImplementation();
  get.mockImplementation((path: string, ...args: unknown[]) =>
    path === "/resident/context"
      ? Promise.resolve({
          data: {
            estates: [
              { id: estateId, name: "Maple Estate" },
              { id: "other", name: "Other estate" },
            ],
            canSubmit: true,
          },
        })
      : original?.(path, ...args)
  );
  renderWithProviders(<NewReportPage requestedEstateId="other" />);
  await screen.findByRole("heading", { name: REPORT_A_FAULT });
  await waitFor(() =>
    expect(
      (screen.getByRole("combobox", { name: "Estate" }) as HTMLInputElement)
        .value
    ).toBe("Other estate")
  );
  expect(get).toHaveBeenCalledWith(
    "/resident/locations",
    expect.objectContaining({ params: { query: { estateId: "other" } } })
  );
});

it("links back to the selected estate's reports through breadcrumbs", async () => {
  renderWithProviders(<NewReportPage requestedEstateId={estateId} />);
  await screen.findByRole("heading", { level: 1, name: REPORT_A_FAULT });
  const crumbs = within(
    screen.getByRole("navigation", { name: "Breadcrumbs" })
  );
  expect(
    crumbs.getByRole("link", { name: "My reports" }).getAttribute("href")
  ).toBe(`/reports?estateId=${estateId}`);
});

it("asks for an estate rather than falling back to another when the selected one is not assigned", async () => {
  renderWithProviders(<NewReportPage requestedEstateId="inactive" />);
  const estate = await screen.findByRole("combobox", { name: "Estate" });
  expect((estate as HTMLInputElement).value).toBe("");
  expect(
    (screen.getByRole("button", { name: SUBMIT_REPORT }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  expect(get).not.toHaveBeenCalledWith(
    "/resident/locations",
    expect.anything()
  );
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
  expect(createBody()).toEqual({
    estateId,
    title: "Leaking pipe",
    description: "Leaking pipe",
    locationId: levelId,
  });
  await waitFor(() => expect(navigate).toHaveBeenCalled());
});

const otherId = "00000000-0000-0000-0000-000000000020";

/** A user with no assigned estates whose search finds Oak Park. */
function mockUnassignedSearch(found: { id: string; name: string }[]) {
  const original = get.getMockImplementation();
  get.mockImplementation((path: string, ...args: unknown[]) => {
    if (path === "/access/context") {
      return Promise.resolve({ data: unassignedAccess });
    }
    if (path === "/resident/context") {
      return Promise.resolve({ data: { estates: [], canSubmit: true } });
    }
    if (path === "/resident/estates") {
      return Promise.resolve({ data: found });
    }
    return original?.(path, ...args);
  });
}

function searchEstates(text: string) {
  fireEvent.change(screen.getByRole("combobox", { name: "Estate" }), {
    target: { value: text },
  });
}

it("lets someone with no assigned estate find any estate and report a fault there", async () => {
  mockUnassignedSearch([{ id: otherId, name: "Oak Park" }]);
  renderWithProviders(<Page />);
  const estate = await screen.findByRole("combobox", { name: "Estate" });
  expect(estate.getAttribute("placeholder")).toBe("Find your estate");
  expect(screen.queryByText(NO_ESTATE_ASSIGNED)).toBeNull();

  searchEstates("oak");
  fireEvent.click(await screen.findByRole("option", { name: "Oak Park" }));
  expect(get).toHaveBeenCalledWith("/resident/estates", {
    params: { query: { q: "oak" } },
  });
  await chooseOption(
    await screen.findByRole("combobox", { name: BLOCK }),
    "Block A"
  );
  await chooseOption(screen.getByRole("combobox", { name: LEVEL }), "Level 2");
  fireEvent.change(screen.getByRole("textbox", { name: DESCRIPTION }), {
    target: { value: "Broken light" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: TITLE }), {
    target: { value: "Broken light" },
  });
  fireEvent.click(screen.getByRole("button", { name: SUBMIT_REPORT }));
  await waitFor(() => expect(post).toHaveBeenCalled());
  expect(createBody().estateId).toBe(otherId);
});

it("waits for two letters before searching for an estate", async () => {
  mockUnassignedSearch([{ id: otherId, name: "Oak Park" }]);
  renderWithProviders(<Page />);
  await screen.findByRole("combobox", { name: "Estate" });

  searchEstates(" o ");
  await screen.findByText("Type at least 2 letters of your estate's name.");
  expect(get).not.toHaveBeenCalledWith("/resident/estates", expect.anything());
});

it("says when no estate matches the search", async () => {
  mockUnassignedSearch([]);
  renderWithProviders(<Page />);
  await screen.findByRole("combobox", { name: "Estate" });

  searchEstates("zz");
  await screen.findByText("No estates match");
});

it("lists the user's own estates before other search results", async () => {
  const original = get.getMockImplementation();
  get.mockImplementation((path: string, ...args: unknown[]) =>
    path === "/resident/estates"
      ? Promise.resolve({
          data: [
            { id: otherId, name: "Maple Court" },
            { id: estateId, name: "Maple Estate" },
          ],
        })
      : original?.(path, ...args)
  );
  renderWithProviders(<Page />);
  const estate = await screen.findByRole("combobox", { name: "Estate" });
  await waitFor(() =>
    expect((estate as HTMLInputElement).value).toBe("Maple Estate")
  );

  searchEstates("maple");
  await screen.findByRole("option", { name: "Maple Court" });
  expect(
    screen.getAllByRole("option").map((option) => option.textContent)
  ).toEqual(["Maple Estate", "Maple Court"]);
});

it("tells the user when the chosen estate is no longer taking reports", async () => {
  post.mockResolvedValue({
    error: { message: "Estate not found." },
    response: { status: 404 },
  });
  renderWithProviders(<Page />);
  await chooseOption(
    await screen.findByRole("combobox", { name: BLOCK }),
    "Block A"
  );
  await chooseOption(screen.getByRole("combobox", { name: LEVEL }), "Level 2");
  fireEvent.change(screen.getByRole("textbox", { name: DESCRIPTION }), {
    target: { value: "Leak" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: TITLE }), {
    target: { value: "Leak" },
  });
  fireEvent.click(screen.getByRole("button", { name: SUBMIT_REPORT }));
  await screen.findByText("This estate is no longer taking reports.");
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
  await waitFor(() =>
    expect(
      (screen.getByRole("combobox", { name: "Estate" }) as HTMLInputElement)
        .value
    ).toBe("Maple Estate")
  );
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
  expect(createBody().locationId).toBe(levelId);
});

it("preselects a requested estate the account manages but does not live in", async () => {
  const original = get.getMockImplementation();
  get.mockImplementation((path: string, init?: unknown) => {
    if (path === "/access/context") {
      return Promise.resolve({ data: mixedAccess });
    }
    if (path === "/resident/context") {
      return Promise.resolve({
        data: {
          estates: [{ id: "maple", name: "Maple Estate" }],
          canSubmit: true,
        },
      });
    }
    return original?.(path, init);
  });
  renderWithProviders(<NewReportPage requestedEstateId="pine" />);
  await waitFor(() =>
    expect(
      (screen.getByRole("combobox", { name: "Estate" }) as HTMLInputElement)
        .value
    ).toBe("Pine Estate")
  );
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith(
      "/resident/locations",
      expect.objectContaining({
        params: expect.objectContaining({
          query: expect.objectContaining({ estateId: "pine" }),
        }),
      })
    )
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
  const reportId = "00000000-0000-0000-0000-0000000000r1";
  const slots = [
    {
      objectKey: `reports/${reportId}/a`,
      uploadUrl: "https://storage.example/a",
    },
    {
      objectKey: `reports/${reportId}/b`,
      uploadUrl: "https://storage.example/b",
    },
  ];
  post.mockImplementation(
    (path: string, options: { body: { contentType?: string } }) =>
      Promise.resolve(
        path === "/resident/reports/image-slots"
          ? {
              data: {
                ...slots[post.mock.calls.length === 1 ? 0 : 1],
                contentType: options.body.contentType,
                maxBytes: 5_242_880,
                expiresAt: "2099-01-01T00:00:00Z",
                reportId,
              },
            }
          : { data: { id: "00000000-0000-0000-0000-000000000010" } }
      )
  );
  const put = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
  vi.stubGlobal("fetch", put);
  fireEvent.click(screen.getByRole("button", { name: SUBMIT_REPORT }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  expect(post.mock.calls[0]).toEqual([
    "/resident/reports/image-slots",
    { body: { estateId, contentType: "image/png", size: gallery.size } },
  ]);
  expect(post.mock.calls[1]).toEqual([
    "/resident/reports/image-slots",
    {
      body: {
        estateId,
        reportId,
        contentType: "image/jpeg",
        size: camera.size,
      },
    },
  ]);
  expect(put).toHaveBeenCalledWith("https://storage.example/a", {
    method: "PUT",
    headers: {
      "Content-Type": "image/png",
      "x-goog-content-length-range": "0,5242880",
    },
    body: gallery,
  });
  expect(put).toHaveBeenCalledWith(
    "https://storage.example/b",
    expect.objectContaining({ body: camera })
  );
  expect(createBody()).toEqual(
    expect.objectContaining({
      reportId,
      imageKeys: [slots[0].objectKey, slots[1].objectKey],
    })
  );
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
  expect(createBody().title).toBe("x".repeat(50));
});

it("lets a multi-estate resident choose an estate and clears the old location selection", async () => {
  const original = get.getMockImplementation();
  get.mockImplementation((path: string, options?: unknown) => {
    if (path === "/resident/estates") {
      return Promise.resolve({ data: [] });
    }
    return path === "/resident/context"
      ? Promise.resolve({
          data: {
            estates: [
              { id: estateId, name: "Maple Estate" },
              { id: "other", name: "Other Estate" },
            ],
            canSubmit: true,
          },
        })
      : original?.(path, options);
  });
  renderWithProviders(<Page />);
  await screen.findByRole("combobox", { name: "Estate" });
  searchEstates("Maple");
  fireEvent.click(await screen.findByRole("option", { name: "Maple Estate" }));
  await chooseOption(
    await screen.findByRole("combobox", { name: BLOCK }),
    "Block A"
  );
  await chooseOption(screen.getByRole("combobox", { name: LEVEL }), "Level 2");
  searchEstates("Other");
  fireEvent.click(await screen.findByRole("option", { name: "Other Estate" }));
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith("/resident/locations", {
      params: { query: { estateId: "other" } },
    })
  );
  expect(
    screen.getByRole("combobox", { name: LEVEL }).textContent
  ).not.toContain("Level 2");
  expect(navigate).toHaveBeenLastCalledWith({
    to: "/reports/new",
    search: { estateId: "other" },
  });
  expect(post).not.toHaveBeenCalled();
});

it("announces loading the estate with the shared loading state", async () => {
  renderWithProviders(<NewReportPage />);
  screen.getByRole("status", { name: "Loading your estate…" });
  await screen.findByRole("heading", { name: "Report a fault" });
});

it("cancels back to the selected estate's reports without submitting", async () => {
  renderWithProviders(<NewReportPage requestedEstateId={estateId} />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  expect(navigate).toHaveBeenCalledWith({
    to: "/reports",
    search: { estateId },
  });
  expect(post).not.toHaveBeenCalled();
});

const AI_NOTICE =
  /text is read by Upkeep's automated classifier, and the report, including photos, may be emailed to the estate's contractor/u;

it("tells residents an automated classifier reads the report and a contractor may receive it", async () => {
  renderWithProviders(<NewReportPage />);
  await screen.findByRole("heading", { name: "Report a fault" });
  await screen.findByText(AI_NOTICE);
});
