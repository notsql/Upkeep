import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));

describe("People & access tab titles", () => {
  it("calls the members tab 'Members'", async () => {
    const { Route } = await import(
      "@/routes/_auth/estates/$estateId/council/index"
    );
    const head = (
      Route as unknown as { options: { head: () => unknown } }
    ).options.head();
    expect(JSON.stringify(head)).toContain('· Members"');
    expect(JSON.stringify(head)).not.toContain("Council");
  });

  it("calls the invitations tab 'Waiting to join'", async () => {
    const { Route } = await import(
      "@/routes/_auth/estates/$estateId/council/invitations/index"
    );
    const head = (
      Route as unknown as { options: { head: () => unknown } }
    ).options.head();
    expect(JSON.stringify(head)).toContain('· Waiting to join"');
  });
});
