import { renderWithProviders, screen } from "@tests/test-utils";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { BackLink } from "@/components/back-link";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => (
    <a
      className={className}
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to
      )}
    >
      {children}
    </a>
  ),
}));

it("links back to its parent page under the given label", () => {
  renderWithProviders(
    <BackLink params={{ estateId: "e1" }} to="/estates/$estateId">
      Back to estate
    </BackLink>
  );
  expect(
    screen.getByRole<HTMLAnchorElement>("link", { name: "Back to estate" }).href
  ).toContain("/estates/e1");
});
