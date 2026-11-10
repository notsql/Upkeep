import { act, fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ComponentType, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readingsQueryKey } from "@/lib/readings";

// Load inside each test so absent planned screens produce individual red tests,
// while this test file still type-checks against today's generated API contract.
const UPLOAD_SCREEN =
  "@/routes/_auth/estates/$estateId/readings/imports/-components/reading-imports-page";
const BATCH_SCREEN =
  "@/routes/_auth/estates/$estateId/readings/imports/$batchId/-components/reading-import-batch-page";
const SOURCE = "Vendor A — October 2026 extract";
const INACTIVE_ESTATE =
  /inactive estate|estate is inactive|estate is deactivated/iu;
const LOAD_FAILURE = /failed to load/iu;
const INSERTED_COUNT = /1 reading/iu;
const CSV =
  "asset_reference,metric,measured_at,value\nPUMP-001,TEMPERATURE,2026-10-01T08:00:00+08:00,999999999999.123456\n";
const EXPORT_CSV =
  "reading_id,measured_at,asset_id,asset_reference,asset_name,metric,value,unit,source,device_id,device_identifier,recorded_by_user_id,recorded_by_name,recorded_at,flags\r\n" +
  "c3f9b8a4-e4c4-4a18-a1b1-2a60cd6b574d,2026-10-01T00:00:00Z,c282cbe7-5a7e-465a-9795-bf7a3c152ded,PUMP-001,Water pump,TEMPERATURE,999999999999.123456,°C,IMPORT,,,,,2026-11-01T00:00:00Z,OUT_OF_RANGE\r\n";
const { get, post, navigate, state } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  navigate: vi.fn(),
  state: {
    userId: "owner",
    canImport: true,
    inactive: false,
    mobile: false,
  },
}));

vi.mock("@/lib/api", () => ({ api: { GET: get, POST: post } }));
vi.mock("@/lib/use-mobile", () => ({ useMobile: () => state.mobile }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: state.userId }, loading: false }),
}));
vi.mock("@/lib/access", () => ({
  useAppAccess: () => ({
    data: {
      estates: ["estate", "another-estate"].map((estateId) => ({
        estateId,
        estateName: "Maple Estate",
        deactivatedAt: state.inactive ? "2026-10-31T00:00:00Z" : null,
        canViewReadings: true,
        canImportReadings: state.canImport && !state.inactive,
        canRevertReadingImports: state.canImport && !state.inactive,
      })),
    },
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigate,
}));

const batch = {
  id: "batch-001",
  estateId: "estate",
  sourceLabel: SOURCE,
  originalFilename: "vendor.csv",
  uploaderUserId: "owner",
  uploaderName: "Alex Tan",
  createdAt: "2026-11-01T00:00:00Z",
  status: "COMPLETED",
  totalRows: 4,
  importedRows: 1,
  duplicateRows: 1,
  invalidRows: 2,
  warningRows: 1,
};
const results = {
  items: [
    {
      recordNumber: 2,
      startingLineNumber: 2,
      outcome: "IMPORTED",
      readingId: "reading-001",
      issues: [
        {
          field: "value",
          code: "OUT_OF_RANGE",
          reason: "Value is outside the expected range.",
        },
      ],
    },
    {
      recordNumber: 3,
      startingLineNumber: 3,
      outcome: "INVALID",
      issues: [
        {
          field: "asset_reference",
          code: "ASSET_NOT_FOUND",
          reason: "Asset was not found in this estate.",
        },
      ],
    },
  ],
  page: 0,
  size: 2,
  totalItems: 4,
};

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(state, {
    userId: "owner",
    canImport: true,
    inactive: false,
    mobile: false,
  });
  get.mockImplementation((path: string) => {
    let data: unknown = batch;
    if (path.endsWith("/imports")) {
      data = { items: [batch], page: 0, size: 50, totalItems: 1 };
    }
    if (path.endsWith("/rows")) {
      data = results;
    }
    if (path.endsWith("/metrics")) {
      data = [
        { metric: "TEMPERATURE", unit: "°C", validMin: -40, validMax: 150 },
      ];
    }
    return Promise.resolve({ data, response: new Response() });
  });
  post.mockResolvedValue({
    data: batch,
    response: new Response(null, { status: 201 }),
  });
});

async function showUpload() {
  const { ReadingImportsPage } = await vi.importActual<{
    ReadingImportsPage: ComponentType<{ estateId: string }>;
  }>(UPLOAD_SCREEN);
  return {
    ReadingImportsPage,
    ...renderWithProviders(<ReadingImportsPage estateId="estate" />),
  };
}

async function showBatch() {
  const { ReadingImportBatchPage } = await vi.importActual<{
    ReadingImportBatchPage: ComponentType<{
      estateId: string;
      batchId: string;
    }>;
  }>(BATCH_SCREEN);
  return renderWithProviders(
    <ReadingImportBatchPage batchId="batch-001" estateId="estate" />
  );
}

async function fill(csv = CSV) {
  const file = new File([csv], "vendor.csv", { type: "text/csv" });
  fireEvent.change(screen.getByLabelText("CSV file"), {
    target: { files: [file] },
  });
  fireEvent.change(
    screen.getByRole("textbox", { name: "Name for this import" }),
    {
      target: { value: SOURCE },
    }
  );
  await screen.findByRole("combobox", { name: "Value column" });
  return file;
}

async function submittedOptions(index: number) {
  const form: unknown = post.mock.calls[index][1].body;
  if (!(form instanceof FormData)) {
    throw new Error("The import request must contain multipart FormData.");
  }
  const options = form.get("options");
  const text =
    typeof options === "string"
      ? options
      : await new Promise<string>((resolve, reject) => {
          if (!(options instanceof Blob)) {
            reject(new Error("Missing multipart options."));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsText(options);
        });
  return JSON.parse(text);
}

describe("historical CSV upload", () => {
  it("offers a labelled file picker, source label and batch history", async () => {
    await showUpload();
    screen.getByRole("heading", { level: 1, name: "Import CSV" });
    screen.getByLabelText("CSV file");
    screen.getByRole("textbox", { name: "Name for this import" });
    await screen.findByText(SOURCE);
    screen.getByRole("button", { name: "Import" });
    screen.getByRole("link", { name: "Cancel" });
  });

  it("requires a file and source label before sending an import", async () => {
    await showUpload();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(post).not.toHaveBeenCalled();
    screen.getByRole("alert");
  });

  it("maps export headers automatically and sends the original file bytes", async () => {
    await showUpload();
    const file = await fill(EXPORT_CSV);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe("/estates/{estateId}/readings/imports");
    const form = post.mock.calls[0][1].body;
    expect(form.get("file")).toEqual(file);
    expect(await submittedOptions(0)).toEqual(
      expect.objectContaining({
        sourceLabel: SOURCE,
        submissionId: expect.any(String),
        mapping: expect.objectContaining({ value: "value" }),
      })
    );
  });

  it("supports explicitly mapping vendor headers before submitting", async () => {
    await showUpload();
    await fill(
      "Equipment,Signal,Observed,Measurement\nPUMP-001,TEMPERATURE,2026-10-01T00:00:00Z,21\n"
    );
    await chooseOption(
      screen.getByRole("combobox", { name: "Asset column" }),
      "Equipment"
    );
    await chooseOption(
      screen.getByRole("combobox", { name: "Measurement column" }),
      "Signal"
    );
    await chooseOption(
      screen.getByRole("combobox", { name: "Measured at column" }),
      "Observed"
    );
    await chooseOption(
      screen.getByRole("combobox", { name: "Value column" }),
      "Measurement"
    );
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect((await submittedOptions(0)).mapping).toEqual(
      expect.objectContaining({
        metric: "Signal",
        measured_at: "Observed",
        value: "Measurement",
      })
    );
  });

  it("prevents repeated submissions and disables the pending footer", async () => {
    post.mockImplementation(() => new Promise(() => undefined));
    await showUpload();
    await fill();
    const submit = screen.getByRole("button", { name: "Import" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it("retains the file, source and mapping and reuses the UUID after an uncertain result", async () => {
    post.mockRejectedValueOnce(new TypeError("Network connection lost"));
    await showUpload();
    const file = await fill();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await screen.findByRole("alert");
    expect(
      (screen.getByLabelText("CSV file") as HTMLInputElement).files?.[0]
    ).toEqual(file);
    expect(
      (
        screen.getByRole("textbox", {
          name: "Name for this import",
        }) as HTMLInputElement
      ).value
    ).toBe(SOURCE);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect((await submittedOptions(1)).submissionId).toBe(
      (await submittedOptions(0)).submissionId
    );
  });

  it("uses a new submission UUID when the source label changes after failure", async () => {
    post.mockRejectedValueOnce(new TypeError("Network connection lost"));
    await showUpload();
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await screen.findByRole("alert");
    fireEvent.change(
      screen.getByRole("textbox", { name: "Name for this import" }),
      {
        target: { value: "Corrected vendor label" },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect((await submittedOptions(1)).submissionId).not.toBe(
      (await submittedOptions(0)).submissionId
    );
  });

  it("does not infer import access from permission to view readings", async () => {
    state.canImport = false;
    await showUpload();
    expect(screen.queryByLabelText("CSV file")).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it("explains inactive-estate restrictions and prevents importing", async () => {
    state.inactive = true;
    await showUpload();
    await screen.findByText(INACTIVE_ESTATE);
    const action = screen.queryByRole("button", { name: "Import" });
    expect(action === null || (action as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(post).not.toHaveBeenCalled();
  });

  it.each(["estate", "account"])(
    "aborts an in-flight import when the %s changes",
    async (change) => {
      post.mockImplementation(() => new Promise(() => undefined));
      const view = await showUpload();
      await fill();
      fireEvent.click(screen.getByRole("button", { name: "Import" }));
      await waitFor(() => expect(post).toHaveBeenCalled());
      const signal: AbortSignal = post.mock.calls[0][1].signal;
      if (change === "account") {
        state.userId = "another-user";
      }
      view.rerender(
        <view.ReadingImportsPage
          estateId={change === "estate" ? "another-estate" : "estate"}
        />
      );
      await waitFor(() => expect(signal.aborted).toBe(true));
    }
  );

  it("refreshes affected reading caches while preserving their applied filters", async () => {
    const view = await showUpload();
    const filters = { metric: "TEMPERATURE", page: 2 };
    const keys = [
      [state.userId, "estate-readings", "estate", filters],
      [state.userId, "reading-assets", "estate"],
      readingsQueryKey(state.userId, "estate", "asset", {}),
    ];
    for (const key of keys) {
      view.queryClient.setQueryData(key, { totalItems: 0, items: [] });
    }
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => {
      for (const key of keys) {
        expect(view.queryClient.getQueryState(key)?.isInvalidated).toBe(true);
      }
    });
    expect(view.queryClient.getQueryState(keys[0])).toBeDefined();
  });

  it("ignores a late successful response from the previous estate", async () => {
    let finish:
      | ((value: { data: typeof batch; response: Response }) => void)
      | undefined;
    post.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const view = await showUpload();
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    get.mockResolvedValue({
      data: { items: [], page: 0, size: 50, totalItems: 0 },
      response: new Response(),
    });
    view.rerender(<view.ReadingImportsPage estateId="another-estate" />);
    await act(() => {
      finish?.({ data: batch, response: new Response(null, { status: 201 }) });
      return Promise.resolve();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByText(SOURCE)).toBeNull();
  });
});

describe("import results and rollback", () => {
  it("pages the row report and resets paging when filtering outcomes", async () => {
    await showBatch();
    fireEvent.click(await screen.findByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        "/estates/{estateId}/readings/imports/{batchId}/rows",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({ page: 1 }),
          }),
        })
      )
    );
    await chooseOption(
      screen.getByRole("combobox", { name: "Outcome" }),
      "Has problems"
    );
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        "/estates/{estateId}/readings/imports/{batchId}/rows",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({ page: 0, outcome: "INVALID" }),
          }),
        })
      )
    );
  });

  it("lists each record as an item on a phone with its line, outcome and problems", async () => {
    state.mobile = true;
    await showBatch();
    await screen.findByText(SOURCE);
    const report = screen.getByRole("list", { name: "Import results" });
    expect(screen.queryByRole("table", { name: "Import results" })).toBeNull();
    const [first, second] = within(report).getAllByRole("listitem");
    within(first as HTMLElement).getByText("Record 2");
    within(first as HTMLElement).getByText("Imported");
    within(first as HTMLElement).getByText(
      "Line 2 · Value is outside the expected range."
    );
    within(second as HTMLElement).getByText("Record 3");
    within(second as HTMLElement).getByText("Has problems");
    within(second as HTMLElement).getByText(
      "Line 3 · Asset was not found in this estate."
    );
    screen.getByRole("link", { name: "Download report" });
    screen.getByRole("button", { name: "Revert batch" });
  });

  it("lists past imports as linked items on a phone", async () => {
    state.mobile = true;
    await showUpload();
    const history = await screen.findByRole("list", { name: "Import history" });
    const item = within(history).getByRole("link", {
      name: new RegExp(SOURCE, "u"),
    });
    within(item).getByText("Imported");
    within(item).getByText("1 readings imported", { exact: false });
  });

  it("preserves record numbers, outcomes and reasons in the table", async () => {
    await showBatch();
    await screen.findByText(SOURCE);
    const report = screen.getByRole("table", {
      name: "Import results",
    });
    // Both the record number and its starting physical line must remain visible.
    expect(within(report).getAllByText("2")).toHaveLength(2);
    expect(within(report).getAllByText("3")).toHaveLength(2);
    within(report).getByText("ASSET_NOT_FOUND");
    within(report).getByText("Asset was not found in this estate.");
    within(report).getByText("OUT_OF_RANGE");
    screen.getByRole("link", { name: "Download report" });
    screen.getByRole("button", { name: "Revert batch" });
  });

  it("shows an all-invalid batch as a completed result with its issues", async () => {
    get.mockImplementation((path: string) =>
      Promise.resolve({
        data: path.endsWith("/rows")
          ? results
          : { ...batch, importedRows: 0, duplicateRows: 0, invalidRows: 4 },
        response: new Response(),
      })
    );
    await showBatch();
    await screen.findByText(SOURCE);
    screen.getByText("ASSET_NOT_FOUND");
    expect(screen.queryByText(LOAD_FAILURE)).toBeNull();
  });

  it("requires a rollback reason and shows the source and actual inserted count", async () => {
    await showBatch();
    fireEvent.click(
      await screen.findByRole("button", { name: "Revert batch" })
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain(SOURCE);
    expect(dialog.textContent).toMatch(INSERTED_COUNT);
    fireEvent.click(screen.getByRole("button", { name: "Confirm revert" }));
    expect(post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Reason" }), {
      target: { value: "Incorrect vendor batch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm revert" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe(
      "/estates/{estateId}/readings/imports/{batchId}/revert"
    );
    expect(post.mock.calls[0][1].body).toEqual({
      reason: "Incorrect vendor batch",
    });
  });

  it("keeps the reason and dialog open if rollback fails", async () => {
    post.mockResolvedValue({
      error: { message: "Rollback temporarily unavailable" },
      response: new Response(null, { status: 503 }),
    });
    await showBatch();
    fireEvent.click(
      await screen.findByRole("button", { name: "Revert batch" })
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Reason" }), {
      target: { value: "Incorrect vendor batch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm revert" }));
    await screen.findByText("Rollback temporarily unavailable");
    screen.getByRole("dialog");
    expect(
      (screen.getByRole("textbox", { name: "Reason" }) as HTMLInputElement)
        .value
    ).toBe("Incorrect vendor batch");
  });

  it("refreshes reading caches after successful rollback", async () => {
    post.mockResolvedValue({
      data: { ...batch, status: "REVERTED", removedCount: 1 },
      response: new Response(),
    });
    const view = await showBatch();
    const key = [state.userId, "estate-readings", "estate", {}];
    view.queryClient.setQueryData(key, { totalItems: 1, items: [] });
    fireEvent.click(
      await screen.findByRole("button", { name: "Revert batch" })
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Reason" }), {
      target: { value: "Wrong batch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm revert" }));
    await waitFor(() =>
      expect(view.queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    );
  });
});
