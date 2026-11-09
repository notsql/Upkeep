import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MembersHeader } from "@/routes/_auth/estates/$estateId/council/-components/council-page/estate-members/members-header";

it("tones the active member count as success", () => {
  render(<MembersHeader count={3} />);
  expect(screen.getByText("3 active").dataset.variant).toBe("success");
});
