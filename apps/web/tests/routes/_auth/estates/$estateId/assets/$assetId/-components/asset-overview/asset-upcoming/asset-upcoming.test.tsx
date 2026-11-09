import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { AssetUpcomingList } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-upcoming/asset-upcoming";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
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
    params?: Record<string, string>;
  }) => (
    <a
      {...props}
      href={to
        .replace("$estateId", params?.estateId ?? "")
        .replace("$assetId", params?.assetId ?? "")}
    >
      {children}
    </a>
  ),
}));

const LIST_PATH = "/estates/{estateId}/inspection-list";
const EVENTS_PATH = "/estates/{estateId}/assets/{assetId}/events";
const INTERVAL_PATH = "/estates/{estateId}/assets/{assetId}/service-interval";

function check(assetId: string, dueOn: string, status: string) {
  return { id: `${assetId}-${dueOn}`, assetId, dueOn, status };
}

let checks: unknown[];
let events: unknown[];
let effective: unknown;

function serve() {
  vi.mocked(api.GET).mockImplementation(((path: string) => {
    const data: Record<string, unknown> = {
      [LIST_PATH]: { checks },
      [EVENTS_PATH]: events,
      [INTERVAL_PATH]: { effective, source: "CATEGORY" },
    };
    return Promise.resolve({ data: data[path], response: new Response() });
  }) as never);
}

function render({
  inspections = true,
  service = true,
  installedOn = "2026-01-10" as string | null,
} = {}) {
  renderWithProviders(
    <AssetUpcomingList
      assetId="asset"
      canSeeInspections={inspections}
      canSeeService={service}
      estateId="estate"
      installedOn={installedOn}
    />
  );
}

function requested(path: string): boolean {
  return (vi.mocked(api.GET).mock.calls as unknown[][]).some(
    ([called]) => called === path
  );
}

describe("AssetUpcomingList", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 8, 9));
    checks = [];
    events = [];
    effective = null;
    serve();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an overdue inspection for this asset in the destructive tone, linking to its records", async () => {
    checks = [
      check("asset", "2026-11-05", "OVERDUE"),
      check("other", "2026-11-01", "OVERDUE"),
      check("asset", "2026-10-01", "DONE"),
    ];
    render({ service: false });
    const list = await screen.findByRole("list", { name: "Upcoming" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    const row = rows[0] as HTMLElement;
    within(row).getByText("Inspection due");
    within(row).getByText(formatDate("2026-11-05"));
    within(row).getByText("3 days overdue");
    expect(row.getAttribute("data-tone")).toBe("overdue");
    expect(within(row).getByRole("link").getAttribute("href")).toBe(
      "/estates/estate/assets/asset/records"
    );
  });

  it("works out the service due date from the last preventive service and the interval, soon within 14 days", async () => {
    effective = { value: 6, unit: "MONTH" };
    events = [
      { id: "e2", type: "BREAKDOWN_REPAIR", occurredOn: "2026-06-01" },
      { id: "e1", type: "PREVENTIVE", occurredOn: "2026-05-13" },
    ];
    render({ inspections: false });
    const row = (await screen.findByText("Service due")).closest("li");
    if (!row) {
      throw new Error("No service row");
    }
    within(row).getByText(formatDate("2026-11-13"));
    within(row).getByText("in 5 days");
    expect(row.getAttribute("data-tone")).toBe("soon");
  });

  it("counts the service interval from installation when never serviced, and mutes later dates", async () => {
    effective = { value: 1, unit: "YEAR" };
    render({ inspections: false, installedOn: "2026-01-10" });
    const row = (await screen.findByText("Service due")).closest("li");
    within(row as HTMLElement).getByText(formatDate("2027-01-10"));
    expect(row?.getAttribute("data-tone")).toBe("later");
  });

  it("orders rows by due date, soonest first", async () => {
    effective = { value: 30, unit: "DAY" };
    events = [{ id: "e1", type: "PREVENTIVE", occurredOn: "2026-10-01" }];
    checks = [check("asset", "2026-11-20", "DUE")];
    render();
    const list = await screen.findByRole("list", { name: "Upcoming" });
    await within(list).findByText("Inspection due");
    const titles = within(list)
      .getAllByRole("listitem")
      .map((row) => row.querySelector("[data-title]")?.textContent);
    expect(titles).toEqual(["Service due", "Inspection due"]);
  });

  it("is a small h3 sub-section, not a card of its own", async () => {
    render();
    await screen.findByText("Nothing scheduled");
    screen.getByRole("heading", { level: 3, name: "Upcoming" });
    expect(screen.queryByRole("region", { name: "Upcoming" })).toBeNull();
  });

  it("says nothing is scheduled when there is nothing due", async () => {
    render();
    await screen.findByText("Nothing scheduled");
    expect(screen.queryByRole("list", { name: "Upcoming" })).toBeNull();
  });

  it("requests nothing the viewer cannot see", async () => {
    render({ inspections: false, service: false });
    await screen.findByText("Nothing scheduled");
    expect(api.GET).not.toHaveBeenCalled();
  });

  it("requests only the inspection list when service is hidden", async () => {
    render({ service: false });
    await screen.findByText("Nothing scheduled");
    expect(requested(LIST_PATH)).toBe(true);
    expect(requested(EVENTS_PATH)).toBe(false);
    expect(requested(INTERVAL_PATH)).toBe(false);
  });
});
