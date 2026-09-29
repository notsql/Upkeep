import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Asset } from "@/lib/assets";
import type { Location } from "@/lib/locations";
import { AssetForm } from "@/routes/_authenticated/estates/$estateId/assets/-components/asset-form";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "../../../../../../test-utils";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

const INSTALLED_ON_LABEL = /^Installation date/;
const MANUFACTURER_LABEL = /^Manufacturer/;
const MODEL_LABEL = /^Model/;
const SERIAL_NUMBER_LABEL = /^Serial number/;
const REQUIRED = /required/i;

const at = "2026-09-27T00:00:00Z";
function location(
  id: string,
  type: Location["type"],
  name: string,
  parentId?: string,
  sortOrder?: number
): Location {
  return { id, type, name, parentId, sortOrder, createdAt: at, updatedAt: at };
}
// The locations endpoint only returns active locations, in server order.
const locations: Location[] = [
  location("b1", "BLOCK", "Blk 101"),
  location("b2", "BLOCK", "Blk 102"),
  location("l1", "LEVEL", "Level 1", "b1", 1),
  location("a1", "COMMON_AREA", "Lift", "b1"),
  location("a2", "COMMON_AREA", "Lift lobby", "l1"),
];

const asset: Asset = {
  id: "asset-id",
  estateId: "estate-id",
  reference: "SUNRISE-A0001",
  name: "Lift A",
  category: "LIFT",
  locationId: "a2",
  locationPath: "Blk 101 › Level 1 › Lift lobby",
  installedOn: "2020-05-01",
  manufacturer: "Otis",
  model: "Gen2",
  serialNumber: "SN-123",
  createdAt: at,
  updatedAt: at,
};

function serveLocations() {
  vi.mocked(api.GET).mockResolvedValue({
    data: locations,
    response: new Response(),
  } as never);
}

/** Resolves once the location options have arrived. */
async function locationsLoaded() {
  await screen.findByRole("option", {
    name: "Blk 101 › Level 1 › Lift lobby",
  });
}

function nameField() {
  return screen.getByRole<HTMLInputElement>("textbox", { name: "Name" });
}
function categoryField() {
  return screen.getByRole<HTMLSelectElement>("combobox", { name: "Category" });
}
function locationField() {
  return screen.getByRole<HTMLSelectElement>("combobox", { name: "Location" });
}
function installedOnField() {
  // Date inputs have no ARIA role, so fall back to the label.
  return screen.getByLabelText<HTMLInputElement>(INSTALLED_ON_LABEL);
}
function manufacturerField() {
  return screen.getByRole<HTMLInputElement>("textbox", {
    name: MANUFACTURER_LABEL,
  });
}
function modelField() {
  return screen.getByRole<HTMLInputElement>("textbox", { name: MODEL_LABEL });
}
function serialNumberField() {
  return screen.getByRole<HTMLInputElement>("textbox", {
    name: SERIAL_NUMBER_LABEL,
  });
}

function fillRequired() {
  fireEvent.change(nameField(), { target: { value: "Lift A" } });
  fireEvent.change(categoryField(), { target: { value: "LIFT" } });
  fireEvent.change(locationField(), { target: { value: "a2" } });
}

describe("AssetForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    serveLocations();
  });

  it("labels every field", async () => {
    renderWithProviders(<AssetForm estateId="estate-id" onSave={vi.fn()} />);
    await locationsLoaded();
    nameField();
    categoryField();
    locationField();
    installedOnField();
    manufacturerField();
    modelField();
    serialNumberField();
    expect(installedOnField().type).toBe("date");
  });

  it("offers every asset category", async () => {
    renderWithProviders(<AssetForm estateId="estate-id" onSave={vi.fn()} />);
    await locationsLoaded();
    expect(
      within(categoryField())
        .getAllByRole<HTMLOptionElement>("option")
        .map((option) => option.value)
        .filter(Boolean)
    ).toEqual([
      "LIFT",
      "PUMP",
      "GENERATOR",
      "LIGHTING",
      "FIRE_SAFETY",
      "HVAC",
      "ELECTRICAL",
      "OTHER",
    ]);
  });

  it("lists every active location of the estate by its full path", async () => {
    renderWithProviders(<AssetForm estateId="estate-id" onSave={vi.fn()} />);
    await locationsLoaded();
    expect(api.GET).toHaveBeenCalledWith("/estates/{estateId}/locations", {
      params: { path: { estateId: "estate-id" } },
    });
    const options = within(locationField())
      .getAllByRole<HTMLOptionElement>("option")
      .filter((option) => option.value);
    expect(options.map((option) => [option.value, option.textContent])).toEqual(
      [
        ["b1", "Blk 101"],
        ["l1", "Blk 101 › Level 1"],
        ["a2", "Blk 101 › Level 1 › Lift lobby"],
        ["a1", "Blk 101 › Lift"],
        ["b2", "Blk 102"],
      ]
    );
  });

  it("explains which required fields are missing instead of saving", async () => {
    const onSave = vi.fn();
    renderWithProviders(<AssetForm estateId="estate-id" onSave={onSave} />);
    await locationsLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Register asset" }));
    await screen.findByRole("textbox", {
      name: "Name",
      description: REQUIRED,
    });
    screen.getByRole("combobox", {
      name: "Category",
      description: REQUIRED,
    });
    screen.getByRole("combobox", {
      name: "Location",
      description: REQUIRED,
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("submits every entered detail", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<AssetForm estateId="estate-id" onSave={onSave} />);
    await locationsLoaded();
    fillRequired();
    fireEvent.change(installedOnField(), { target: { value: "2020-05-01" } });
    fireEvent.change(manufacturerField(), { target: { value: "Otis" } });
    fireEvent.change(modelField(), { target: { value: "Gen2" } });
    fireEvent.change(serialNumberField(), { target: { value: "SN-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Register asset" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        name: "Lift A",
        category: "LIFT",
        locationId: "a2",
        installedOn: "2020-05-01",
        manufacturer: "Otis",
        model: "Gen2",
        serialNumber: "SN-123",
      })
    );
  });

  it("leaves blank optional details out of the payload", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<AssetForm estateId="estate-id" onSave={onSave} />);
    await locationsLoaded();
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Register asset" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0]).toEqual({
      name: "Lift A",
      category: "LIFT",
      locationId: "a2",
    });
  });

  it("keeps entered details and explains a failed save", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValue(new Error("This location has been deactivated."));
    renderWithProviders(<AssetForm estateId="estate-id" onSave={onSave} />);
    await locationsLoaded();
    fillRequired();
    fireEvent.change(manufacturerField(), { target: { value: "Otis" } });
    fireEvent.click(screen.getByRole("button", { name: "Register asset" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "deactivated"
    );
    expect(nameField().value).toBe("Lift A");
    expect(categoryField().value).toBe("LIFT");
    expect(locationField().value).toBe("a2");
    expect(manufacturerField().value).toBe("Otis");
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>("button", {
          name: "Register asset",
        }).disabled
      ).toBe(false)
    );
  });

  it("does not submit twice while a save is pending", async () => {
    let finish: (value?: unknown) => void = () => undefined;
    const onSave = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    renderWithProviders(<AssetForm estateId="estate-id" onSave={onSave} />);
    await locationsLoaded();
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Register asset" }));
    const pending = await screen.findByRole<HTMLButtonElement>("button", {
      name: "Saving…",
    });
    expect(pending.disabled).toBe(true);
    fireEvent.click(pending);
    fireEvent.submit(pending.form as HTMLFormElement);
    finish();
    await screen.findByRole("button", { name: "Register asset" });
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("pre-fills an existing asset and shows its reference read-only", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <AssetForm estateId="estate-id" initialValues={asset} onSave={onSave} />
    );
    await locationsLoaded();
    const reference = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Reference",
    });
    expect(reference.value).toBe("SUNRISE-A0001");
    expect(reference.readOnly).toBe(true);
    expect(nameField().value).toBe("Lift A");
    expect(categoryField().value).toBe("LIFT");
    await waitFor(() => expect(locationField().value).toBe("a2"));
    expect(installedOnField().value).toBe("2020-05-01");
    expect(manufacturerField().value).toBe("Otis");
    expect(modelField().value).toBe("Gen2");
    expect(serialNumberField().value).toBe("SN-123");

    fireEvent.change(nameField(), { target: { value: "Lift B" } });
    fireEvent.change(locationField(), { target: { value: "a1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        name: "Lift B",
        category: "LIFT",
        locationId: "a1",
        installedOn: "2020-05-01",
        manufacturer: "Otis",
        model: "Gen2",
        serialNumber: "SN-123",
      })
    );
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("reference");
  });

  it("has no reference field when registering a new asset", async () => {
    renderWithProviders(<AssetForm estateId="estate-id" onSave={vi.fn()} />);
    await locationsLoaded();
    expect(screen.queryByRole("textbox", { name: "Reference" })).toBeNull();
  });
});
