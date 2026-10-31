import { act, fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReadingSearch } from "@/lib/reading-filters";
import { EstateReadingsPage } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page";

const state = vi.hoisted(() => ({
  get: vi.fn(),
  userId: "reader",
  allowed: true,
}));
vi.mock("@/lib/api", () => ({ api: { GET: state.get } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: state.userId }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/access", () => ({
  useAppAccess: () => ({
    data: {
      estates: ["estate", "other"].map((estateId) => ({
        estateId,
        estateName: estateId,
        canViewReadings: state.allowed,
        canRecordReadings: false,
      })),
    },
  }),
}));
const EXPORT = "/estates/{estateId}/readings/export";
const HEADER =
  "reading_id,measured_at,asset_id,asset_reference,asset_name,metric,value,unit,source,device_id,device_identifier,recorded_by_user_id,recorded_by_name,recorded_at,flags\r\n";
const ROW =
  "r1,2026-10-01T00:00:00.000000Z,asset,A1,Pump,TEMPERATURE,-1.000000,°C,SENSOR,device,S1,,,2026-10-01T00:00:01.000000Z,\r\n";
const FILENAME =
  "readings-v1-00000000-0000-0000-0000-000000000001-20261028T000000Z.csv";
const NativeURL = URL;
const createUrl = vi.fn();
const revokeUrl = vi.fn();
let total = 1;
let failed = false;
let pending: ReadableStream<Uint8Array> | undefined;
function result(body: string, count = 1) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return {
    data: pending ?? stream,
    response: new Response(null, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "X-Export-Row-Count": String(count),
        "Content-Disposition": `attachment; filename="${FILENAME}"`,
      },
    }),
  };
}
function page(estateId = "estate", filters: ReadingSearch = {}) {
  return (
    <EstateReadingsPage
      estateId={estateId}
      filters={filters}
      onFiltersChange={vi.fn()}
    />
  );
}
async function start() {
  const button = await screen.findByRole("button", { name: "Export CSV" });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  fireEvent.click(button);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  state.userId = "reader";
  state.allowed = true;
  total = 1;
  failed = false;
  pending = undefined;
  createUrl.mockReturnValue("blob:qa-export");
  vi.stubGlobal(
    "URL",
    class extends NativeURL {
      static createObjectURL = createUrl;
      static revokeObjectURL = revokeUrl;
    }
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    () => undefined
  );
  state.get.mockImplementation((path: string) => {
    if (path === EXPORT) {
      return Promise.resolve(
        failed
          ? {
              error: { message: "Export unavailable" },
              response: new Response(null, { status: 503 }),
            }
          : result(HEADER + (total ? ROW : ""), total)
      );
    }
    if (path.endsWith("/assets")) {
      return Promise.resolve({
        data: { items: [], page: 0, size: 50, totalItems: 0 },
        response: new Response(),
      });
    }
    return Promise.resolve({
      data: { items: [], page: 0, size: 50, totalItems: total },
      response: new Response(),
    });
  });
});
it("exports all applied filters without page/size and saves only a completed CSV", async () => {
  const filters = {
    assetId: "00000000-0000-0000-0000-000000000002",
    metric: "TEMPERATURE",
    from: "2026-10-01T08:00",
    to: "2026-10-02T08:00",
    suspect: true,
    page: 7,
  };
  renderWithProviders(page("estate", filters));
  await start();
  await waitFor(() => expect(createUrl).toHaveBeenCalledTimes(1));
  const call = state.get.mock.calls.find(([path]) => path === EXPORT);
  expect(call?.[1]).toEqual(
    expect.objectContaining({
      params: {
        path: { estateId: "estate" },
        query: {
          assetId: "00000000-0000-0000-0000-000000000002",
          metric: "TEMPERATURE",
          from: new Date(filters.from).toISOString(),
          to: new Date(filters.to).toISOString(),
          flag: ["GAP", "DUPLICATE_TIMESTAMP", "OUT_OF_RANGE"],
        },
      },
      parseAs: "stream",
      signal: expect.any(AbortSignal),
    })
  );
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  expect(revokeUrl).toHaveBeenCalledWith("blob:qa-export");
});
it("downloads a header-only CSV for zero matching rows", async () => {
  total = 0;
  renderWithProviders(page());
  await start();
  await waitFor(() => expect(createUrl).toHaveBeenCalledTimes(1));
});
it("cancels a pending transfer without saving an incomplete file", async () => {
  pending = new ReadableStream();
  renderWithProviders(page());
  await start();
  const cancel = await screen.findByRole("button", { name: "Cancel export" });
  expect(createUrl).not.toHaveBeenCalled();
  fireEvent.click(cancel);
  await screen.findByText("Export cancelled.");
  expect(
    state.get.mock.calls.find(([path]) => path === EXPORT)?.[1].signal.aborted
  ).toBe(true);
  expect(createUrl).not.toHaveBeenCalled();
});
it("keeps filters after failure and retries only when explicitly requested", async () => {
  failed = true;
  renderWithProviders(page("estate", { metric: "TEMPERATURE" }));
  await start();
  await screen.findByText("Export unavailable");
  expect(state.get.mock.calls.filter(([path]) => path === EXPORT)).toHaveLength(
    1
  );
  failed = false;
  await start();
  await waitFor(() => expect(createUrl).toHaveBeenCalledTimes(1));
});
it.each(["truncated", "broken stream", "wrong header", "no count"])(
  "rejects an incomplete or invalid CSV: %s",
  async (mode) => {
    const serve = state.get.getMockImplementation();
    state.get.mockImplementation((path: string) => {
      if (path !== EXPORT) {
        return serve?.(path);
      }
      if (mode === "truncated") {
        return Promise.resolve(result(HEADER + ROW, 2));
      }
      if (mode === "wrong header") {
        return Promise.resolve(result(`error\r\n${ROW}`));
      }
      if (mode === "no count") {
        return Promise.resolve({
          data: result(HEADER + ROW).data,
          response: new Response(null, {
            headers: { "Content-Type": "text/csv" },
          }),
        });
      }
      return Promise.resolve({
        data: new ReadableStream({
          start(c) {
            c.error(new Error("connection lost"));
          },
        }),
        response: result(HEADER + ROW).response,
      });
    });
    renderWithProviders(page());
    await start();
    await screen.findByRole("alert");
    expect(createUrl).not.toHaveBeenCalled();
  }
);
it.each(["estate", "account", "revoked"])(
  "aborts a stale transfer after %s changes",
  async (change) => {
    pending = new ReadableStream();
    const view = renderWithProviders(page());
    await start();
    await screen.findByRole("button", { name: "Cancel export" });
    const request = state.get.mock.calls.find(([path]) => path === EXPORT)?.[1];
    if (change === "account") {
      state.userId = "another-reader";
    }
    if (change === "revoked") {
      state.allowed = false;
    }
    view.rerender(page(change === "estate" ? "other" : "estate"));
    await waitFor(() => expect(request.signal.aborted).toBe(true));
    expect(createUrl).not.toHaveBeenCalled();
  }
);
it("disables export for an invalid range", async () => {
  renderWithProviders(
    page("estate", { from: "2026-10-02T00:00", to: "2026-10-01T00:00" })
  );
  expect(
    (await screen.findByRole("button", { name: "Export CSV" })).hasAttribute(
      "disabled"
    )
  ).toBe(true);
  expect(state.get.mock.calls.some(([path]) => path === EXPORT)).toBe(false);
});
it("disables export until the active list settles", async () => {
  const serve = state.get.getMockImplementation();
  state.get.mockImplementation((path: string) =>
    path === "/estates/{estateId}/readings"
      ? new Promise(() => {
          /* Keep the list request pending. */
        })
      : serve?.(path)
  );
  renderWithProviders(page());
  expect(
    (await screen.findByRole("button", { name: "Export CSV" })).hasAttribute(
      "disabled"
    )
  ).toBe(true);
});
it("preserves filter capture when filters change while downloading", async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  pending = new ReadableStream({
    start(c) {
      controller = c;
    },
  });
  const view = renderWithProviders(page("estate", { metric: "TEMPERATURE" }));
  await start();
  await screen.findByRole("button", { name: "Cancel export" });
  view.rerender(page("estate", { metric: "PRESSURE" }));
  act(() => {
    controller.enqueue(new TextEncoder().encode(HEADER + ROW));
    controller.close();
  });
  await waitFor(() => expect(createUrl).toHaveBeenCalledTimes(1));
  expect(
    state.get.mock.calls.find(([path]) => path === EXPORT)?.[1].params.query
      .metric
  ).toBe("TEMPERATURE");
});

it("validates quoted multiline Unicode fields across byte chunks", async () => {
  const bytes = new TextEncoder().encode(
    HEADER + ROW.replace("Pump", '"Pump,\n""泵"""')
  );
  pending = new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += 3) {
        controller.enqueue(bytes.slice(offset, offset + 3));
      }
      controller.close();
    },
  });
  renderWithProviders(page());
  await start();
  await waitFor(() => expect(createUrl).toHaveBeenCalledTimes(1));
  expect((createUrl.mock.calls[0][0] as Blob).size).toBe(bytes.length);
});

it.each([0, 1])(
  "preserves the UTF-8 BOM in a %i-row Excel download across byte chunks",
  async (count) => {
    total = count;
    const bytes = new TextEncoder().encode(
      `\uFEFF${HEADER}${count ? ROW : ""}`
    );
    pending = new ReadableStream({
      start(controller) {
        for (const byte of bytes) {
          controller.enqueue(new Uint8Array([byte]));
        }
        controller.close();
      },
    });
    renderWithProviders(page());
    await start();
    await waitFor(() => expect(createUrl).toHaveBeenCalledTimes(1));
    const blob = createUrl.mock.calls[0][0] as Blob;
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    expect(Array.from(new Uint8Array(buffer))).toEqual(Array.from(bytes));
    expect(Array.from(new Uint8Array(buffer).slice(0, 3))).toEqual([
      239, 187, 191,
    ]);
  }
);
