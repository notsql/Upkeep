import { isRedirect } from "@tanstack/react-router";
import { expect, it } from "vitest";
import { Route } from "@/routes/_auth/invitations/index";

it("sends old invitation links to the estate directory, where invitations now live", () => {
  const beforeLoad = Route.options.beforeLoad as unknown as () => unknown;
  let thrown: unknown;
  try {
    beforeLoad();
  } catch (error) {
    thrown = error;
  }
  expect(isRedirect(thrown)).toBe(true);
  expect((thrown as { options: { to?: string } }).options.to).toBe("/estates");
});
