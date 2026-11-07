import { getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/api/auth/sign-in";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
}));
vi.mock("@workos/authkit-tanstack-react-start", () => ({
  getSignInUrl: vi.fn(),
}));
// The router mock exposes the registered HTTP handler for contract testing.
const handler = (
  Route as unknown as {
    server: {
      handlers: { GET: (input: { request: Request }) => Promise<Response> };
    };
  }
).server.handlers.GET;
beforeEach(() => vi.resetAllMocks());
it("preserves PKCE and forwards the invitation token to hosted authentication", async () => {
  vi.mocked(getSignInUrl).mockResolvedValue(
    "https://auth.example.com/authorize?state=sealed&code_challenge=pkce"
  );
  const response = await handler({
    request: new Request(
      "http://localhost:3001/api/auth/sign-in?invitation_token=invite-token"
    ),
  });
  const url = new URL(response.headers.get("Location") ?? "");
  expect(url.searchParams.get("invitation_token")).toBe("invite-token");
  expect(url.searchParams.get("state")).toBe("sealed");
  expect(url.searchParams.get("code_challenge")).toBe("pkce");
  expect(getSignInUrl).toHaveBeenCalledWith({
    data: { returnPathname: "/estates" },
  });
});
it("retains the requested safe destination for ordinary sign-in", async () => {
  vi.mocked(getSignInUrl).mockResolvedValue(
    "https://auth.example.com/authorize?state=sealed"
  );
  await handler({
    request: new Request(
      "http://localhost:3001/api/auth/sign-in?returnPathname=%2Faccount"
    ),
  });
  expect(getSignInUrl).toHaveBeenCalledWith({
    data: { returnPathname: "/account" },
  });
});
