import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Location } from "@/lib/locations";
import { DeviceForm } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "../../../../../../../test-utils";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

const REQUIRED = /required/i;
const INTERVAL = /^Expected reporting interval/;

const at = "2026-09-28T00:00:00Z";
function location(id: string, name: string, parentId?: string): Location {
  return {
    id,
    type: parentId ? "COMMON_AREA" : "BLOCK",
    name,
    parentId,
    createdAt: at,
    updatedAt: at,
  };
}
const locations: Location[] = [
  location("b1", "Blk 101"),
  location("plant", "Plant room", "b1"),
  location("pipes", "Pipe run", "b1"),
];

function identifierField() {
  return screen.getByRole<HTMLInputElement>("textbox", { name: "Identifier" });
}
function modelField() {
  return screen.getByRole<HTMLInputElement>("textbox", { name: "Model" });
}
function locationField() {
  return screen.getByRole("combobox", { name: "Location" });
}
function intervalField() {
  return screen.getByRole<HTMLInputElement>("spinbutton", { name: INTERVAL });
}
function metric(name: string) {
  return screen.getByRole("checkbox", { name });
}
function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Register device" }));
}

async function renderForm(onSave = vi.fn().mockResolvedValue(undefined)) {
  renderWithProviders(
    <DeviceForm
      defaultLocationId="plant"
      estateId="estate-id"
      onSave={onSave}
    />
  );
  // The asset's location shows by its path once the locations have loaded.
  await waitFor(() =>
    within(locationField()).getByText("Blk 101 › Plant room")
  );
  return onSave;
}

describe("DeviceForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.GET).mockResolvedValue({
      data: locations,
      response: new Response(),
    } as never);
  });

  it("starts at the asset's location and offers every metric with its unit", async () => {
    await renderForm();
    within(locationField()).getByText("Blk 101 › Plant room");
    for (const name of [
      "Temperature (°C)",
      "Humidity (%)",
      "Pressure (bar)",
      "Flow rate (L/min)",
      "Vibration (mm/s)",
      "Vibration acceleration (g)",
      "Power (kW)",
      "Energy (kWh)",
    ]) {
      metric(name);
    }
  });

  it("registers the device with trimmed details, the chosen metrics and interval", async () => {
    const onSave = await renderForm();
    fireEvent.change(identifierField(), { target: { value: " PUMP-01 " } });
    fireEvent.change(modelField(), { target: { value: " PT-100 " } });
    await chooseOption(locationField(), "Blk 101 › Pipe run");
    fireEvent.click(metric("Pressure (bar)"));
    fireEvent.click(metric("Temperature (°C)"));
    fireEvent.change(intervalField(), { target: { value: "300" } });
    submit();
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        identifier: "PUMP-01",
        model: "PT-100",
        locationId: "pipes",
        metrics: ["TEMPERATURE", "PRESSURE"],
        reportingIntervalSeconds: 300,
      })
    );
  });

  it("requires every detail and at least one metric before saving", async () => {
    const onSave = await renderForm();
    fireEvent.change(intervalField(), { target: { value: "" } });
    submit();
    // Identifier, model and interval; location starts at the asset's.
    expect(await screen.findAllByText(REQUIRED)).toHaveLength(3);
    screen.getByText("Choose at least one metric.");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("rejects an interval outside one second to one day", async () => {
    const onSave = await renderForm();
    fireEvent.change(identifierField(), { target: { value: "PUMP-01" } });
    fireEvent.change(modelField(), { target: { value: "PT-100" } });
    fireEvent.click(metric("Power (kW)"));
    fireEvent.change(intervalField(), { target: { value: "86401" } });
    submit();
    await screen.findByText("Enter a whole number of seconds from 1 to 86400.");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps what was entered and explains a rejected registration", async () => {
    const onSave = await renderForm(
      vi
        .fn()
        .mockRejectedValue(
          new Error('A device with identifier "PUMP-01" is already registered.')
        )
    );
    fireEvent.change(identifierField(), { target: { value: "PUMP-01" } });
    fireEvent.change(modelField(), { target: { value: "PT-100" } });
    fireEvent.click(metric("Power (kW)"));
    submit();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "already registered"
    );
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(identifierField().value).toBe("PUMP-01");
    screen.getByRole("checkbox", { name: "Power (kW)", checked: true });
  });
});
