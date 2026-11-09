import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DispatchAction } from "@/components/dispatch/dispatch-action";
import { api } from "@/lib/api";
import type { InspectionCheck } from "@/lib/inspection-list";

const INSPECTED = /Sent to Ahmad Rahman · due/u;
const SENT_TO = /Inspected on .* \(Pass\)/u;

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "manager" }, loading: false }),
}));
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
  }) => {
    let href = to;
    for (const [key, value] of Object.entries(params ?? {})) {
      href = href.replace(`$${key}`, value);
    }
    const query = new URLSearchParams(search ?? {}).toString();
    return <a href={query ? `${href}?${query}` : href}>{children}</a>;
  },
}));

let checks: InspectionCheck[];
let openOrder: { id: string; reference: string } | null;

function check(overrides: Partial<InspectionCheck>): InspectionCheck {
  return {
    id: "check",
    assetId: "pump",
    assetReference: "P-1",
    assetName: "Booster pump",
    categoryLabel: "Pump",
    block: { id: "b", name: "Block A" },
    level: null,
    dueOn: "2026-11-09",
    dueBasis: "REQUESTED",
    interval: null,
    intervalSource: null,
    status: "DUE",
    result: null,
    requestedByName: "Morgan Lee",
    assignedToName: "Ahmad Rahman",
    ...overrides,
  } as InspectionCheck;
}

let inspectors: { userId: string; name: string; roleName: string }[];
const everyone = [
  { userId: "crew", name: "Ahmad Rahman", roleName: "Crew" },
  { userId: "manager", name: "Morgan Lee", roleName: "Manager" },
];

beforeEach(() => {
  vi.mocked(api.GET).mockReset();
  vi.mocked(api.POST).mockReset();
  toastSuccess.mockReset();
  checks = [];
  openOrder = null;
  inspectors = everyone;
  vi.mocked(api.GET).mockImplementation(((path: string) => {
    if (path === "/estates/{estateId}/inspection-list") {
      return Promise.resolve({
        data: { checks },
        response: new Response(null, { status: 200 }),
      });
    }
    if (path === "/estates/{estateId}/inspectors") {
      return Promise.resolve({
        data: inspectors,
        response: new Response(null, { status: 200 }),
      });
    }
    if (path === "/estates/{estateId}/who-can-help") {
      return Promise.resolve({
        data: { action: "SEND_CREW", roles: ["Manager", "Facilities lead"] },
        response: new Response(null, { status: 200 }),
      });
    }
    if (path === "/estates/{estateId}/assets/{assetId}/open-work-order") {
      return Promise.resolve({
        data: openOrder ?? undefined,
        response: new Response(null, { status: openOrder ? 200 : 204 }),
      });
    }
    return Promise.reject(new Error(`Unexpected ${path}`));
  }) as never);
});

function renderAction(
  route: "CREW" | "CONTRACTOR",
  canSend = true
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <DispatchAction
      assetId="pump"
      assetName="Booster pump"
      canSend={canSend}
      estateId="estate"
      route={route}
    />
  );
}

describe("DispatchAction: send a contractor", () => {
  it("links to a work order form filled in for end of life", async () => {
    renderAction("CONTRACTOR");
    const link = await screen.findByRole("link", { name: "Send a contractor" });
    expect(link.getAttribute("href")).toBe(
      "/estates/estate/work-orders/new?assetId=pump&reason=END_OF_LIFE"
    );
  });

  it("names the work order already sent instead of a second button", async () => {
    openOrder = { id: "wo", reference: "EST-W0007" };
    renderAction("CONTRACTOR");
    const link = await screen.findByRole("link", {
      name: "Contractor already sent · EST-W0007",
    });
    expect(link.getAttribute("href")).toBe("/estates/estate/work-orders/wo");
    expect(
      screen.queryByRole("link", { name: "Send a contractor" })
    ).toBeNull();
  });

  it("asks a reader who cannot send to ask someone", async () => {
    renderAction("CONTRACTOR", false);
    await screen.findByText(
      "Ask a Manager or a Facilities lead to send a contractor."
    );
    expect(
      screen.queryByRole("link", { name: "Send a contractor" })
    ).toBeNull();
  });
});

describe("DispatchAction: send crew", () => {
  it("sends the chosen person and confirms it", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      data: check({}),
      response: new Response(null, { status: 201 }),
    } as never);
    renderAction("CREW");
    fireEvent.click(
      await screen.findByRole("button", { name: "Send crew to inspect" })
    );
    await screen.findByRole("dialog", {
      name: "Who should inspect Booster pump?",
    });
    await chooseOption(
      await screen.findByRole("combobox", { name: "Person" }),
      "Ahmad Rahman · Crew"
    );
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "Sent to Ahmad Rahman to inspect Booster pump."
      )
    );
    expect(api.POST).toHaveBeenCalledWith(
      "/estates/{estateId}/assets/{assetId}/inspection-requests",
      {
        params: { path: { estateId: "estate", assetId: "pump" } },
        body: { assignedToUserId: "crew" },
      }
    );
  });

  it("says when there is no crew yet", async () => {
    inspectors = everyone.filter((person) => person.roleName !== "Crew");
    renderAction("CREW");
    fireEvent.click(
      await screen.findByRole("button", { name: "Send crew to inspect" })
    );
    await screen.findByText(
      "No crew in this estate yet. Invite crew in People & access."
    );
  }, 10_000);

  it("shows who was already sent instead of the button", async () => {
    checks = [check({})];
    renderAction("CREW");
    await screen.findByText(INSPECTED);
    expect(
      screen.queryByRole("button", { name: "Send crew to inspect" })
    ).toBeNull();
  });

  it("disables sending once inspected this month", async () => {
    checks = [
      check({
        status: "DONE",
        result: { id: "r", outcome: "PASS", inspectedOn: "2026-11-03" },
      }),
    ];
    renderAction("CREW");
    const button = await screen.findByRole("button", {
      name: SENT_TO,
    });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("tells the manager when the person can no longer inspect", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      error: { message: "Ahmad Rahman can no longer record inspections here." },
      response: new Response(null, { status: 400 }),
    } as never);
    renderAction("CREW");
    fireEvent.click(
      await screen.findByRole("button", { name: "Send crew to inspect" })
    );
    await chooseOption(
      await screen.findByRole("combobox", { name: "Person" }),
      "Ahmad Rahman · Crew"
    );
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText(
      "Ahmad Rahman can no longer record inspections here. Choose someone else."
    );
  });

  it("asks a reader who cannot send to ask someone", async () => {
    renderAction("CREW", false);
    await screen.findByText("Ask a Manager or a Facilities lead to send crew.");
    expect(
      screen.queryByRole("button", { name: "Send crew to inspect" })
    ).toBeNull();
  });
});
