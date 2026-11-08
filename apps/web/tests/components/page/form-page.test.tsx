import { renderWithProviders, screen, within } from "@tests/test-utils";
import { expect, it } from "vitest";
import { FormCard, FormPage } from "@/components/page/form-page";

it("renders the page heading, description and the form inside", async () => {
  renderWithProviders(
    <FormPage
      breadcrumbs={[{ label: "Create" }]}
      description="Equipment and its location"
      title="Register asset"
    >
      <FormCard>
        <form aria-label="Asset">
          <input aria-label="Name" />
        </form>
      </FormCard>
    </FormPage>
  );
  await screen.findByRole("heading", { level: 1, name: "Register asset" });
  screen.getByText("Equipment and its location");
  const form = screen.getByRole("form", { name: "Asset" });
  within(form).getByRole("textbox", { name: "Name" });
});

it("labels a form card section by its title", () => {
  renderWithProviders(
    <FormCard description="Who did the work" title="Details">
      <p>Fields</p>
    </FormCard>
  );
  const section = screen.getByRole("region", { name: "Details" });
  within(section).getByText("Who did the work");
  expect(within(section).getByText("Fields")).toBeTruthy();
});
