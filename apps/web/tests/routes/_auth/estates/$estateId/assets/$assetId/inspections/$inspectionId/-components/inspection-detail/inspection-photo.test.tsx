import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { InspectionPhoto } from "@/routes/_auth/estates/$estateId/assets/$assetId/inspections/$inspectionId/-components/inspection-detail/inspection-photo";

const photo = vi.hoisted(() => ({
  result: {} as Record<string, unknown>,
}));
vi.mock("@/lib/inspections", () => ({
  useInspectionPhoto: () => photo.result,
}));

const link = "https://storage.example/inspection-photo?signature=1";

function renderPhoto() {
  return renderWithProviders(
    <InspectionPhoto
      assetId="asset"
      estateId="estate"
      inspectionId="inspection"
      number={2}
      photoId="photo"
    />
  );
}

beforeEach(() => {
  photo.result = {
    data: { url: link, expiresAt: "2099-01-01T00:00:00Z" },
    isError: false,
    refetch: vi.fn(),
  };
});

it("shows the photo straight from its short-lived link and opens it full size", () => {
  renderPhoto();

  const image = screen.getByRole("img", { name: "Inspection evidence 2" });
  expect(image.getAttribute("src")).toBe(link);
  const open = screen.getByRole("link");
  expect(open.getAttribute("href")).toBe(link);
  expect(open.getAttribute("rel")).toBe("noopener");
});

it("offers a retry when the photo cannot be loaded", () => {
  photo.result = { data: undefined, isError: true, refetch: vi.fn() };
  renderPhoto();

  screen.getByText("Photo unavailable.");
  screen.getByRole("button", { name: "Retry photo 2" });
});
