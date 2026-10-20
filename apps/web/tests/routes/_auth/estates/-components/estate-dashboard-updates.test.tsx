import { fireEvent } from "@testing-library/react";
import { unassignedAccess } from "@tests/fixtures/access";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useDashboardSummary } from "@/lib/dashboard";
import { EstateEditorPage } from "@/routes/_auth/estates/-components/estate-editor-page";
import { EstateDetailsPage } from "@/routes/_auth/estates/$estateId/-components/estate-details-page";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
const estate = {
  id: "estate",
  name: "Maple Grove",
  code: "MG-001",
  address: "1 Road",
  postalCode: "123456",
  owned: true,
};
let count = 1;
let estateName = "Maple Grove";
function SummaryProbe() {
  const summary = useDashboardSummary();
  return (
    <>
      <p aria-label="Active estate count" role="status">
        {summary.data?.activeEstateCount}
      </p>
      <p aria-label="Attention estate name" role="status">
        {summary.data?.estatesNeedingAttention[0]?.estateName}
      </p>
    </>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  count = 1;
  estateName = "Maple Grove";
  vi.mocked(api.GET).mockImplementation((path) => {
    if (path === "/dashboard/summary") {
      return Promise.resolve({
        data: {
          activeEstateCount: count,
          estatesNeedingAttention: [{ estateName }],
        },
        response: new Response(),
      }) as never;
    }
    return Promise.resolve({
      data: path === "/access/context" ? unassignedAccess : estate,
      response: new Response(),
    }) as never;
  });
  vi.mocked(api.POST).mockImplementation(() => {
    count = 2;
    return Promise.resolve({ data: estate, response: new Response() }) as never;
  });
  vi.mocked(api.PATCH).mockImplementation(() => {
    estateName = "Maple Gardens";
    return Promise.resolve({ data: estate, response: new Response() }) as never;
  });
});
for (const mode of ["create", "edit"]) {
  it(`refreshes the Home summary after an estate ${mode}`, async () => {
    renderWithProviders(
      <>
        <SummaryProbe />
        <EstateEditorPage estateId={mode === "edit" ? "estate" : undefined} />
      </>
    );
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Active estate count" }).textContent
      ).toBe("1")
    );
    const name = await screen.findByRole("textbox", { name: "Name" });
    fireEvent.change(name, {
      target: { value: mode === "edit" ? "Maple Gardens" : "Maple Grove" },
    });
    for (const [label, value] of [
      ["Estate code", "MG-001"],
      ["Address", "1 Road"],
      ["Postal code", "123456"],
    ]) {
      fireEvent.change(screen.getByRole("textbox", { name: label }), {
        target: { value },
      });
    }
    fireEvent.click(
      screen.getByRole("button", {
        name: mode === "edit" ? "Save changes" : "Create estate",
      })
    );
    if (mode === "edit") {
      await waitFor(() =>
        expect(
          screen.getByRole("status", { name: "Attention estate name" })
            .textContent
        ).toBe("Maple Gardens")
      );
      expect(
        screen.getByRole("status", { name: "Active estate count" }).textContent
      ).toBe("1");
    } else {
      await waitFor(() =>
        expect(
          screen.getByRole("status", { name: "Active estate count" })
            .textContent
        ).toBe("2")
      );
    }
  });
}
it("refreshes the Home summary when an estate is deactivated", async () => {
  vi.mocked(api.POST).mockImplementation(() => {
    count = 0;
    return Promise.resolve({
      data: { ...estate, deactivatedAt: "2026-10-08T00:00:00Z" },
      response: new Response(),
    }) as never;
  });
  renderWithProviders(
    <>
      <SummaryProbe />
      <EstateDetailsPage estateId="estate" />
    </>
  );
  await waitFor(() =>
    expect(
      screen.getByRole("status", { name: "Active estate count" }).textContent
    ).toBe("1")
  );
  fireEvent.click(screen.getByRole("button", { name: "Deactivate estate" }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.change(dialog.getByRole("textbox", { name: "Estate code" }), {
    target: { value: "MG-001" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Deactivate estate" }));
  await waitFor(() =>
    expect(
      screen.getByRole("status", { name: "Active estate count" }).textContent
    ).toBe("0")
  );
});
