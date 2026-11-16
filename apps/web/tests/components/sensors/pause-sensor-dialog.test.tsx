import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { PauseSensorDialog } from "@/components/sensors/pause-sensor-dialog";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";

vi.mock("@/lib/flatlined-sensors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/flatlined-sensors")>()),
  usePauseFlatlineSensor: () => ({
    isPending: false,
    mutate: vi.fn(),
    reset: vi.fn(),
    error: null,
  }),
}));

const sensor = {
  deviceId: "device",
  identifier: "PUMP-01",
  metric: "PRESSURE",
} as unknown as MonitoredSensor;

it("names the time unit in words, not its code", async () => {
  renderWithProviders(
    <PauseSensorDialog estateId="estate" onClose={vi.fn()} sensor={sensor} />
  );
  const unit = await screen.findByRole("combobox", { name: "Time unit" });
  expect(unit.textContent).toContain("Minutes");
  expect(unit.textContent).not.toContain("minutes");
});
