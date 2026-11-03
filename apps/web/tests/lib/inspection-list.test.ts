import { createElement, useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
  inspectionListQueryKey,
  useGenerateInspectionList,
  useInspectionList,
} from "@/lib/inspection-list";
import { renderWithProviders, screen, waitFor } from "../test-utils";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "manager" }, loading: false }),
}));

function List() {
  const list = useInspectionList("estate-id");
  return list.data
    ? createElement("output", null, `${list.data.dueCount} due`)
    : null;
}

function Generate() {
  const generate = useGenerateInspectionList("estate-id");
  const { mutate } = generate;
  useEffect(() => {
    mutate();
  }, [mutate]);
  return generate.error
    ? createElement("output", null, generate.error.message)
    : null;
}

describe("inspection list hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the list under the user's key", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { dueCount: 3 },
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(List));
    await screen.findByText("3 due");
    expect(api.GET).toHaveBeenCalledWith(
      "/estates/{estateId}/inspection-list",
      {
        params: { path: { estateId: "estate-id" } },
      }
    );
    expect(
      queryClient.getQueryCache().find({
        queryKey: inspectionListQueryKey("manager", "estate-id"),
      })
    ).toBeDefined();
  });

  it("generates and refreshes the list", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      data: { added: 2, list: {} },
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(Generate));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(
        "/estates/{estateId}/inspection-list/generate",
        { params: { path: { estateId: "estate-id" } } }
      )
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: inspectionListQueryKey("manager", "estate-id"),
      })
    );
  });

  it("turns a refused generation into an error", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      error: { message: "This estate is inactive." },
      response: new Response(null, { status: 409 }),
    } as never);
    renderWithProviders(createElement(Generate));
    await screen.findByText("This estate is inactive.");
  });
});
