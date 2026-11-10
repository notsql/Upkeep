import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it } from "vitest";
import { DetailList } from "@/components/page/detail-list";

it("shows each term and value in a list without a card around it", () => {
  renderWithProviders(
    <DetailList>
      <div>
        <dt>Email</dt>
        <dd>pat@example.com</dd>
      </div>
    </DetailList>
  );
  const term = screen.getByRole("term");
  expect(term.textContent).toBe("Email");
  screen.getByRole("definition");
  screen.getByText("pat@example.com");
  expect(term.closest("[data-slot='card']")).toBeNull();
});
