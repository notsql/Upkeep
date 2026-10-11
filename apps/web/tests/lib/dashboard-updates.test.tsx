import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { useCallback } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useRecordAssessment } from "@/lib/assessments";
import {
  useCreateAsset,
  useDeactivateAsset,
  useRestoreAsset,
} from "@/lib/assets";
import { useDashboardSummary } from "@/lib/dashboard";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
let total = 4;
let faulty = 1;
function DashboardUpdates() {
  const summary = useDashboardSummary();
  const create = useCreateAsset("estate");
  const retire = useDeactivateAsset("estate", "asset");
  const restore = useRestoreAsset("estate", "asset");
  const assess = useRecordAssessment("estate", "asset");
  const createAsset = useCallback(
    () =>
      create.mutate({
        name: "New lift",
        category: "LIFT",
        locationId: "location",
      }),
    [create.mutate]
  );
  const retireAsset = useCallback(
    () =>
      retire.mutate({
        reference: "REF",
        retiredOn: "2026-10-08",
        retirementReason: "Broken",
        expectedVersion: 0,
      }),
    [retire.mutate]
  );
  const restoreAsset = useCallback(
    () => restore.mutate({ reference: "REF", expectedVersion: 0 }),
    [restore.mutate]
  );
  const recordAssessment = useCallback(
    () =>
      assess.mutate({
        assessedOn: "2026-10-08",
        condition: "FAULTY",
        notes: "Pump fault",
      }),
    [assess.mutate]
  );
  return (
    <>
      <p aria-label="Active asset count" role="status">
        {summary.data?.totalActiveAssets}
      </p>
      <p aria-label="Faulty asset count" role="status">
        {summary.data?.conditionCounts.faulty}
      </p>
      <button onClick={createAsset} type="button">
        Create asset
      </button>
      <button onClick={retireAsset} type="button">
        Retire asset
      </button>
      <button onClick={restoreAsset} type="button">
        Restore asset
      </button>
      <button onClick={recordAssessment} type="button">
        Record assessment
      </button>
    </>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  total = 4;
  faulty = 1;
  vi.mocked(api.GET).mockImplementation(
    async () =>
      ({
        data: { totalActiveAssets: total, conditionCounts: { faulty } },
        response: new Response(),
      }) as never
  );
  vi.mocked(api.POST).mockImplementation((path: string) => {
    if (path.endsWith("/assessments")) {
      faulty = 2;
    } else {
      total = path.endsWith("/deactivate") ? 3 : 5;
    }
    return Promise.resolve({
      data: { id: "asset" },
      response: new Response(),
    }) as never;
  });
});
for (const action of [
  "Create asset",
  "Retire asset",
  "Restore asset",
  "Record assessment",
]) {
  it(`refreshes the Home summary after ${action.toLowerCase()}`, async () => {
    renderWithProviders(<DashboardUpdates />);
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Active asset count" }).textContent
      ).toBe("4")
    );
    fireEvent.click(screen.getByRole("button", { name: action }));
    const expectedTotal = action === "Retire asset" ? "3" : "5";
    if (action === "Record assessment") {
      await waitFor(() =>
        expect(
          screen.getByRole("status", { name: "Faulty asset count" }).textContent
        ).toBe("2")
      );
      expect(
        screen.getByRole("status", { name: "Active asset count" }).textContent
      ).toBe("4");
    } else {
      await waitFor(() =>
        expect(
          screen.getByRole("status", { name: "Active asset count" }).textContent
        ).toBe(expectedTotal)
      );
      expect(
        screen.getByRole("status", { name: "Faulty asset count" }).textContent
      ).toBe("1");
    }
  });
}
