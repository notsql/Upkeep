import { fireEvent } from "@testing-library/react";
import { mockMobileViewport } from "@tests/mock-viewport";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { AssetRegisterPage } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page/asset-register-page";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: { estateId: string; assetId?: string };
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={to
        .replace("$estateId", params?.estateId ?? "")
        .replace("$assetId", params?.assetId ?? "")}
      {...props}
    >
      {children}
    </a>
  ),
}));

const FLAGGED = /^Flagged/u;
const ESTATE = "5f1e7c2a-3b4d-4e6f-8a9b-0c1d2e3f4a01";
const BLOCK_A = "5f1e7c2a-3b4d-4e6f-8a9b-0c1d2e3f4a02";
const LEVEL_1 = "5f1e7c2a-3b4d-4e6f-8a9b-0c1d2e3f4a03";
const LEVEL_2 = "5f1e7c2a-3b4d-4e6f-8a9b-0c1d2e3f4a04";
const PUMP = "5f1e7c2a-3b4d-4e6f-8a9b-0c1d2e3f4a05";
const FAN = "5f1e7c2a-3b4d-4e6f-8a9b-0c1d2e3f4a06";

const locations = [
  { id: BLOCK_A, name: "Block A", type: "BLOCK", parentId: null },
  { id: LEVEL_1, name: "L1", type: "LEVEL", parentId: BLOCK_A, sortOrder: 1 },
  { id: LEVEL_2, name: "L2", type: "LEVEL", parentId: BLOCK_A, sortOrder: 2 },
];
const assets = [
  {
    id: PUMP,
    reference: "E-A0001",
    name: "Water pump",
    category: "PUMP",
    locationId: LEVEL_1,
    locationPath: "Block A › L1",
    currentCondition: "GOOD",
    lifecycleVersion: 0,
  },
  {
    id: FAN,
    reference: "E-A0002",
    name: "Exhaust fan",
    category: "FAN",
    locationId: LEVEL_2,
    locationPath: "Block A › L2",
    currentCondition: "FAULTY",
    lifecycleVersion: 0,
  },
];
const devices = [
  { id: "d1", assetId: PUMP, status: "ONLINE" },
  { id: "d2", assetId: PUMP, status: "OFFLINE" },
];
const risks = [
  {
    assetId: FAN,
    assetReference: "E-A0002",
    assetName: "Exhaust fan",
    category: "FAN",
    basis: "SERVICE_INTERVAL",
    failuresObserved: 0,
    flagged: true,
    flagReasons: ["CONDITION"],
  },
  {
    assetId: PUMP,
    assetReference: "E-A0001",
    assetName: "Water pump",
    category: "PUMP",
    basis: "SERVICE_INTERVAL",
    failuresObserved: 0,
    flagged: false,
    flagReasons: [],
  },
];

interface Reply {
  data?: unknown;
  error?: unknown;
  response: Response;
}
const ok = (data: unknown): Reply => ({ data, response: new Response() });
const failed = (): Reply => ({
  error: { message: "Server error" },
  response: new Response(null, { status: 500 }),
});

function mockApi({
  owned = true,
  role = "MEMBER",
  overrides = {},
}: {
  owned?: boolean;
  role?: string;
  overrides?: Record<string, () => Promise<Reply> | Reply>;
} = {}) {
  const replies: Record<string, () => Promise<Reply> | Reply> = {
    "/estates/{id}": () => ok({ id: ESTATE, name: "Maple Grove", owned }),
    "/access/context": () =>
      ok({ estates: [{ estateId: ESTATE, role, canViewAssets: true }] }),
    "/estates/{estateId}/assets": () => ok(assets),
    "/estates/{estateId}/locations": () => ok(locations),
    "/estates/{estateId}/devices": () => ok(devices),
    "/estates/{estateId}/failure-risk": () => ok(risks),
    ...overrides,
  };
  vi.mocked(api.GET).mockImplementation(
    async (path) => (await (replies[path]?.() ?? ok([]))) as never
  );
}

function renderRegister() {
  return renderWithProviders(
    <AssetRegisterPage
      estateId={ESTATE}
      filters={{}}
      onFiltersChange={vi.fn()}
    />
  );
}

function calledPaths(): string[] {
  return vi.mocked(api.GET).mock.calls.map((call) => call[0] as string);
}

function assetOrder(): string[] {
  return screen
    .getAllByRole("link")
    .map((link) => link.textContent ?? "")
    .filter((text) => text === "Water pump" || text === "Exhaust fan");
}

describe("assets by location", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("puts assets on two levels of one block under one block heading with two level subheadings", async () => {
    mockApi();
    renderRegister();
    const blocks = await screen.findAllByRole("heading", {
      level: 2,
      name: "Block A",
    });
    expect(blocks).toHaveLength(1);
    screen.getByRole("heading", { level: 3, name: "L1" });
    screen.getByRole("heading", { level: 3, name: "L2" });
    // Levels read top to bottom like the location tree: L2 above L1.
    expect(assetOrder()).toEqual(["Exhaust fan", "Water pump"]);
  });

  it("groups the mobile cards the same way", async () => {
    const resize = mockMobileViewport();
    mockApi();
    renderRegister();
    await screen.findByRole("heading", { level: 2, name: "Block A" });
    const level1 = screen.getByRole("list", { name: "Block A › L1 assets" });
    within(level1).getByRole("link", { name: "Water pump (E-A0001)" });
    await within(level1).findByText("1 of 2 offline");
    resize(false);
  });

  it("shows the device summary and a risk flag for the owner", async () => {
    mockApi();
    renderRegister();
    await screen.findByRole("columnheader", { name: "Devices" });
    screen.getByRole("columnheader", { name: "Risk" });
    const pumpRow = (
      await screen.findByRole("link", { name: "Water pump" })
    ).closest("tr") as HTMLElement;
    await within(pumpRow).findByText("1 of 2 offline");
    const fanRow = screen
      .getByRole("link", { name: "Exhaust fan" })
      .closest("tr") as HTMLElement;
    await within(fanRow).findByText("No devices");
    await within(fanRow).findByText("Flagged: Condition");
    expect(within(pumpRow).queryByText(FLAGGED)).toBeNull();
  });

  it("omits the risk column, and never requests failure risk, for a non-owner", async () => {
    mockApi({ owned: false, role: "MANAGER" });
    renderRegister();
    await screen.findByRole("link", { name: "Water pump" });
    await screen.findByText("1 of 2 offline");
    expect(screen.queryByRole("columnheader", { name: "Risk" })).toBeNull();
    expect(calledPaths()).not.toContain("/estates/{estateId}/failure-risk");
  });

  it("omits the device column, and never requests devices, for a viewer who is neither owner nor Manager", async () => {
    mockApi({ owned: false, role: "MEMBER" });
    renderRegister();
    await screen.findByRole("link", { name: "Water pump" });
    expect(screen.queryByRole("columnheader", { name: "Devices" })).toBeNull();
    expect(calledPaths()).not.toContain("/estates/{estateId}/devices");
  });

  it("keeps rows when devices and failure risk fail, marking those columns Unavailable with one Alert naming both", async () => {
    mockApi({
      overrides: {
        "/estates/{estateId}/devices": failed,
        "/estates/{estateId}/failure-risk": failed,
      },
    });
    renderRegister();
    await screen.findByRole("link", { name: "Water pump" });
    const alert = await screen.findByText(
      "Device status and failure risk could not be loaded."
    );
    expect(screen.getAllByText("Unavailable")).toHaveLength(4);
    screen.getByRole("link", { name: "Exhaust fan" });
    const retry = within(
      alert.closest("[role='alert']") as HTMLElement
    ).getByRole("button", { name: "Retry" });
    mockApi();
    fireEvent.click(retry);
    await screen.findByText("1 of 2 offline");
    await screen.findByText("Flagged: Condition");
    await waitFor(() =>
      expect(
        screen.queryByText(
          "Device status and failure risk could not be loaded."
        )
      ).toBeNull()
    );
  });

  it("names only the failed source", async () => {
    mockApi({ overrides: { "/estates/{estateId}/failure-risk": failed } });
    renderRegister();
    await screen.findByText("Failure risk could not be loaded.");
    await screen.findByText("1 of 2 offline");
    expect(screen.getAllByText("Unavailable")).toHaveLength(2);
  });

  it("shows skeletons while devices and risk load, without reordering rows when they resolve", async () => {
    let resolveDevices: (reply: Reply) => void = () => undefined;
    let resolveRisk: (reply: Reply) => void = () => undefined;
    mockApi({
      overrides: {
        "/estates/{estateId}/devices": () =>
          new Promise<Reply>((resolve) => {
            resolveDevices = resolve;
          }),
        "/estates/{estateId}/failure-risk": () =>
          new Promise<Reply>((resolve) => {
            resolveRisk = resolve;
          }),
      },
    });
    renderRegister();
    await screen.findByRole("link", { name: "Water pump" });
    await waitFor(() =>
      expect(
        screen.getAllByRole("status", { name: "Loading device summary" })
      ).toHaveLength(2)
    );
    expect(
      screen.getAllByRole("status", { name: "Loading failure risk" })
    ).toHaveLength(2);
    const before = assetOrder();
    resolveDevices(ok(devices));
    resolveRisk(ok(risks));
    await screen.findByText("1 of 2 offline");
    await screen.findByText("Flagged: Condition");
    expect(assetOrder()).toEqual(before);
  });

  it("links By location and All devices for a viewer who can open both", async () => {
    mockApi();
    renderRegister();
    const nav = await screen.findByRole("navigation", { name: "Asset views" });
    within(nav).getByRole("link", { name: "By location" });
    within(nav).getByRole("link", { name: "All devices" });
  });

  it("shows no view tabs to a viewer who cannot open All devices", async () => {
    mockApi({ owned: false, role: "MEMBER" });
    renderRegister();
    await screen.findByRole("link", { name: "Water pump" });
    expect(
      screen.queryByRole("navigation", { name: "Asset views" })
    ).toBeNull();
  });
});
