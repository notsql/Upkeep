import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SimulatorPage } from "@/routes/-components/simulator-page";

vi.mock("@/lib/send-telemetry", () => ({ sendTelemetry: vi.fn() }));

afterEach(() => {
  localStorage.clear();
});

it("remembers the API URL, device key and mode in this browser", async () => {
  const first = render(<SimulatorPage />);
  fireEvent.change(screen.getByLabelText("API URL"), {
    target: { value: "https://api.example.com" },
  });
  fireEvent.change(screen.getByLabelText("Device key"), {
    target: { value: "dk_secret" },
  });
  fireEvent.click(screen.getByRole("tab", { name: "Live" }));
  first.unmount();

  render(<SimulatorPage />);
  await waitFor(() =>
    expect((screen.getByLabelText("API URL") as HTMLInputElement).value).toBe(
      "https://api.example.com"
    )
  );
  expect((screen.getByLabelText("Device key") as HTMLInputElement).value).toBe(
    "dk_secret"
  );
  expect(
    screen.getByRole("tab", { name: "Live" }).getAttribute("aria-selected")
  ).toBe("true");
});
