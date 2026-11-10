import { renderWithProviders, screen } from "@tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AskSomeoneLine } from "@/components/who-can-help/ask-someone-line";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "crew" }, loading: false }),
}));

beforeEach(() => {
  vi.mocked(api.GET).mockReset();
});

describe("AskSomeoneLine", () => {
  it("names the roles the server says can do the action", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { action: "SEND_CREW", roles: ["Manager", "estate owner"] },
      error: undefined,
      response: new Response(),
    } as never);
    renderWithProviders(
      <AskSomeoneLine action="SEND_CREW" doing="send crew" estateId="e1" />
    );
    await screen.findByText("Ask a Manager or the estate owner to send crew.");
    expect(api.GET).toHaveBeenCalledWith("/estates/{estateId}/who-can-help", {
      params: { path: { estateId: "e1" }, query: { action: "SEND_CREW" } },
    });
  });

  it("asks someone who manages the estate when the lookup fails", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: undefined,
      error: { message: "boom" },
      response: new Response(null, { status: 500 }),
    } as never);
    renderWithProviders(
      <AskSomeoneLine
        action="SEND_CONTRACTOR"
        doing="send a contractor"
        estateId="e1"
      />
    );
    await screen.findByText(
      "Ask someone who manages this estate to send a contractor."
    );
  });
});
