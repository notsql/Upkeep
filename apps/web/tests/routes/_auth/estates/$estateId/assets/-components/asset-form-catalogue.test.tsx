import type { components } from "@proj/api/schema";
import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Location } from "@/lib/locations";
import { AssetForm } from "@/routes/_auth/estates/$estateId/assets/-components/asset-form";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

type AssetCategory = components["schemas"]["AssetCategoryResponse"];
type Manufacturer = components["schemas"]["ManufacturerResponse"];
type AssetModel = components["schemas"]["AssetModelResponse"];

const MANUFACTURER_LABEL = /^Manufacturer/;
const MODEL_LABEL = /^Model/;
const MODELS_PATH = "/manufacturers/{manufacturerId}/models";

const at = "2026-09-27T00:00:00Z";
const locations: Location[] = [
  { id: "b1", type: "BLOCK", name: "Blk 101", createdAt: at, updatedAt: at },
];
// The server orders categories by label.
const categories: AssetCategory[] = [
  { code: "HVAC", label: "Air-con & ventilation" },
  { code: "LIFT", label: "Lift & escalator" },
  { code: "PUMP", label: "Pump" },
];
const manufacturers: Manufacturer[] = [
  { id: "m1", name: "GRUNDFOS" },
  { id: "m2", name: "GRUNDFOS ASIA" },
];
const models: AssetModel[] = [
  { id: "x1", manufacturerId: "m1", category: "PUMP", name: "CR 10-3" },
];

function serveCatalogue() {
  const data: Record<string, unknown> = {
    "/estates/{estateId}/locations": locations,
    "/asset-categories": categories,
    "/manufacturers": manufacturers,
    [MODELS_PATH]: models,
  };
  vi.mocked(api.GET).mockImplementation(((path: string) =>
    Promise.resolve({
      data: data[path],
      response: new Response(),
    })) as never);
}

function nameField() {
  return screen.getByRole<HTMLInputElement>("textbox", { name: "Name" });
}
function categoryField() {
  return screen.getByRole("combobox", { name: "Category" });
}
function locationField() {
  return screen.getByRole("combobox", { name: "Location" });
}
// Manufacturer and model are comboboxes that also accept free text.
function manufacturerField() {
  return screen.getByRole<HTMLInputElement>("combobox", {
    name: MANUFACTURER_LABEL,
  });
}
function modelField() {
  return screen.getByRole<HTMLInputElement>("combobox", { name: MODEL_LABEL });
}

async function renderForm(onSave = vi.fn().mockResolvedValue(undefined)) {
  renderWithProviders(<AssetForm estateId="estate-id" onSave={onSave} />);
  await waitFor(() => within(locationField()).getByText("Select a location"));
  return onSave;
}

function modelLookups() {
  // api.GET is overloaded per path, so its mocked call tuples type as never.
  const calls = vi.mocked(api.GET).mock.calls as unknown as [string, unknown][];
  return calls.filter(([path]) => path === MODELS_PATH);
}

describe("AssetForm catalogue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    serveCatalogue();
  });

  it("lists the categories from the server by label", async () => {
    await renderForm();
    expect(api.GET).toHaveBeenCalledWith("/asset-categories");
    fireEvent.click(categoryField());
    expect(
      (await screen.findAllByRole("option")).map((option) => option.textContent)
    ).toEqual(["Air-con & ventilation", "Lift & escalator", "Pump"]);
  });

  it("suggests manufacturers as the user types", async () => {
    await renderForm();
    fireEvent.change(manufacturerField(), { target: { value: "gru" } });
    await screen.findByRole("option", { name: "GRUNDFOS" });
    screen.getByRole("option", { name: "GRUNDFOS ASIA" });
    expect(api.GET).toHaveBeenCalledWith("/manufacturers", {
      params: { query: { query: "gru" } },
    });
  });

  it("suggests models only for the chosen manufacturer and category", async () => {
    await renderForm();
    await chooseOption(categoryField(), "Pump");
    fireEvent.change(manufacturerField(), { target: { value: "gru" } });
    fireEvent.click(await screen.findByRole("option", { name: "GRUNDFOS" }));
    await waitFor(() => expect(manufacturerField().value).toBe("GRUNDFOS"));

    fireEvent.change(modelField(), { target: { value: "cr" } });
    await screen.findByRole("option", { name: "CR 10-3" });
    expect(api.GET).toHaveBeenCalledWith(MODELS_PATH, {
      params: {
        path: { manufacturerId: "m1" },
        query: { category: "PUMP", query: "cr" },
      },
    });
    for (const [, options] of modelLookups()) {
      expect(options).toMatchObject({
        params: { path: { manufacturerId: "m1" }, query: { category: "PUMP" } },
      });
    }
  });

  it("does not look up models before a listed manufacturer is chosen", async () => {
    await renderForm();
    await chooseOption(categoryField(), "Pump");
    fireEvent.change(manufacturerField(), { target: { value: "Acme" } });
    await waitFor(() =>
      expect(api.GET).toHaveBeenCalledWith("/manufacturers", {
        params: { query: { query: "Acme" } },
      })
    );
    fireEvent.change(modelField(), { target: { value: "cr" } });
    expect(modelLookups()).toHaveLength(0);
  });

  it("accepts an unlisted manufacturer and model and sends them as text", async () => {
    const onSave = await renderForm();
    fireEvent.change(nameField(), { target: { value: "Booster pump 1" } });
    await chooseOption(categoryField(), "Pump");
    await chooseOption(locationField(), "Blk 101");
    fireEvent.change(manufacturerField(), { target: { value: "Acme Pumps" } });
    fireEvent.change(modelField(), { target: { value: "X1" } });
    fireEvent.click(screen.getByRole("button", { name: "Register asset" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        name: "Booster pump 1",
        category: "PUMP",
        locationId: "b1",
        manufacturer: "Acme Pumps",
        model: "X1",
      })
    );
  });
});
