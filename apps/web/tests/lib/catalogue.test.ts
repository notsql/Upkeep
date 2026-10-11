import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
  useAssetCategories,
  useAssetModels,
  useManufacturers,
} from "@/lib/catalogue";
import { renderWithProviders, screen } from "../test-utils";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

function CategoriesProbe() {
  const query = useAssetCategories();
  if (query.error) {
    return createElement("p", { role: "alert" }, query.error.message);
  }
  return createElement(
    "ul",
    null,
    query.data?.map((c) => createElement("li", { key: c.code }, c.label))
  );
}

function ManufacturersProbe() {
  const query = useManufacturers("gru");
  if (query.error) {
    return createElement("p", { role: "alert" }, query.error.message);
  }
  return createElement(
    "ul",
    null,
    query.data?.map((m) => createElement("li", { key: m.id }, m.name))
  );
}

function ModelsProbe() {
  const query = useAssetModels("m1", "PUMP", "cr");
  return createElement(
    "ul",
    null,
    query.data?.map((m) => createElement("li", { key: m.id }, m.name))
  );
}

describe("catalogue hooks", () => {
  beforeEach(() => vi.resetAllMocks());

  it("loads the asset categories", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [{ code: "PUMP", label: "Pump" }],
      response: new Response(),
    } as never);
    renderWithProviders(createElement(CategoriesProbe));
    await screen.findByText("Pump");
    expect(api.GET).toHaveBeenCalledWith("/asset-categories");
  });

  it("throws when the categories cannot be loaded", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      error: { message: "Service unavailable." },
      response: new Response(null, { status: 503 }),
    } as never);
    renderWithProviders(createElement(CategoriesProbe));
    await screen.findByRole("alert");
  });

  it("searches manufacturers by what was typed", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [{ id: "m1", name: "GRUNDFOS" }],
      response: new Response(),
    } as never);
    renderWithProviders(createElement(ManufacturersProbe));
    await screen.findByText("GRUNDFOS");
    expect(api.GET).toHaveBeenCalledWith("/manufacturers", {
      params: { query: { query: "gru" } },
    });
  });

  it("throws when the manufacturer search fails", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      error: { message: "Service unavailable." },
      response: new Response(null, { status: 503 }),
    } as never);
    renderWithProviders(createElement(ManufacturersProbe));
    await screen.findByRole("alert");
  });

  it("searches a manufacturer's models in one category", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [
        { id: "x1", manufacturerId: "m1", category: "PUMP", name: "CR 10-3" },
      ],
      response: new Response(),
    } as never);
    renderWithProviders(createElement(ModelsProbe));
    await screen.findByText("CR 10-3");
    expect(api.GET).toHaveBeenCalledWith(
      "/manufacturers/{manufacturerId}/models",
      {
        params: {
          path: { manufacturerId: "m1" },
          query: { category: "PUMP", query: "cr" },
        },
      }
    );
  });
});
