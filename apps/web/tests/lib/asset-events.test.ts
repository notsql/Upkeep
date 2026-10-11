import type { components } from "@proj/api/schema";
import { fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
  assetEventsQueryKey,
  useAssetEvents,
  useRecordAssetEvent,
} from "@/lib/asset-events";
import {
  assetFailureRiskQueryKey,
  estateFailureRiskQueryKey,
} from "@/lib/failure-risk";
import { renderWithProviders, screen, waitFor } from "../test-utils";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

type AssetEvent = components["schemas"]["AssetEventResponse"];
type AssetEventInput = components["schemas"]["CreateAssetEventRequest"];

const event: AssetEvent = {
  id: "event-id",
  assetId: "asset-id",
  category: "MAINTENANCE",
  type: "BREAKDOWN_REPAIR",
  occurredOn: "2026-09-20",
  notes: "Replaced the impeller.",
  assetManufacturer: "GRUNDFOS",
  assetModel: "CR 10-3",
  countsTowardForecast: true,
  recordedByUserId: "owner",
  recordedByName: "Olive Owner",
  createdAt: "2026-09-20T03:00:00Z",
};

const input: AssetEventInput = {
  type: "BREAKDOWN_REPAIR",
  occurredOn: "2026-09-20",
  notes: "Replaced the impeller.",
};

function EventsProbe() {
  const query = useAssetEvents("estate-id", "asset-id");
  if (query.error) {
    return createElement("p", { role: "alert" }, query.error.message);
  }
  return createElement(
    "ul",
    null,
    query.data?.map((item) => createElement("li", { key: item.id }, item.notes))
  );
}

function RecordProbe() {
  const record = useRecordAssetEvent("estate-id", "asset-id");
  return createElement(
    "div",
    null,
    createElement(
      "button",
      { onClick: () => record.mutate(input), type: "button" },
      "Record"
    ),
    record.isSuccess ? createElement("p", null, "Recorded") : null,
    record.error
      ? createElement("p", { role: "alert" }, record.error.message)
      : null
  );
}

describe("asset event query keys", () => {
  it("scope an asset's events to the signed-in user, estate and asset", () => {
    const key = assetEventsQueryKey("owner", "estate-id", "asset-id");
    expect(key).toContain("owner");
    expect(key).toContain("estate-id");
    expect(key).toContain("asset-id");
  });

  it("do not let two users share cached events", () => {
    expect(assetEventsQueryKey("owner", "estate-id", "asset-id")).not.toEqual(
      assetEventsQueryKey("someone-else", "estate-id", "asset-id")
    );
  });
});

describe("useAssetEvents", () => {
  beforeEach(() => vi.resetAllMocks());

  it("loads the asset's events under the user's key", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [event],
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(EventsProbe));
    await screen.findByText("Replaced the impeller.");
    expect(api.GET).toHaveBeenCalledWith(
      "/estates/{estateId}/assets/{assetId}/events",
      { params: { path: { estateId: "estate-id", assetId: "asset-id" } } }
    );
    expect(
      queryClient.getQueryData(
        assetEventsQueryKey("owner", "estate-id", "asset-id")
      )
    ).toEqual([event]);
  });

  it("throws the server's message when the request fails", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      error: { message: "Asset not found." },
      response: new Response(null, { status: 404 }),
    } as never);
    renderWithProviders(createElement(EventsProbe));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Asset not found."
    );
  });
});

describe("useRecordAssetEvent", () => {
  beforeEach(() => vi.resetAllMocks());

  it("posts the event and refreshes the asset's events and forecasts", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      data: event,
      response: new Response(null, { status: 201 }),
    } as never);
    const { queryClient } = renderWithProviders(createElement(RecordProbe));
    const eventsKey = assetEventsQueryKey("owner", "estate-id", "asset-id");
    const assetRiskKey = assetFailureRiskQueryKey(
      "owner",
      "estate-id",
      "asset-id"
    );
    const estateRiskKey = estateFailureRiskQueryKey("owner", "estate-id");
    queryClient.setQueryData(eventsKey, []);
    queryClient.setQueryData(assetRiskKey, {});
    queryClient.setQueryData(estateRiskKey, []);

    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    await screen.findByText("Recorded");

    expect(api.POST).toHaveBeenCalledWith(
      "/estates/{estateId}/assets/{assetId}/events",
      {
        params: { path: { estateId: "estate-id", assetId: "asset-id" } },
        body: input,
      }
    );
    await waitFor(() => {
      expect(queryClient.getQueryState(eventsKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(assetRiskKey)?.isInvalidated).toBe(
        true
      );
      expect(queryClient.getQueryState(estateRiskKey)?.isInvalidated).toBe(
        true
      );
    });
  });

  it("throws the server's message when recording fails", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      error: { message: "This asset is deactivated." },
      response: new Response(null, { status: 409 }),
    } as never);
    renderWithProviders(createElement(RecordProbe));
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "This asset is deactivated."
    );
  });
});
