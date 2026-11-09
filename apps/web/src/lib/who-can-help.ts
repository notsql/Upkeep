import type { components } from "@proj/api/schema";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useEstateSession } from "@/lib/estates";

export type HelpAction = components["schemas"]["HelpAction"];

const OWNER = "estate owner";
const VOWEL = /^[aeiou]/iu;

function withArticle(role: string): string {
  if (role === OWNER) {
    return `the ${OWNER}`;
  }
  return `${VOWEL.test(role) ? "an" : "a"} ${role}`;
}

/**
 * "Ask a Manager or the estate owner to send crew." from the server's role
 * names. Never adds a role of its own; nobody named falls back to "someone
 * who manages this estate".
 */
export function askSomeone(roles: string[], doing: string): string {
  const named = roles.map(withArticle);
  if (named.length === 0) {
    return `Ask someone who manages this estate to ${doing}.`;
  }
  const last = named.at(-1);
  const who =
    named.length === 1 ? last : `${named.slice(0, -1).join(", ")} or ${last}`;
  return `Ask ${who} to ${doing}.`;
}

export function whoCanHelpQueryKey(
  userId: string | undefined,
  estateId: string,
  action: HelpAction
) {
  return [userId, "estates", estateId, "who-can-help", action] as const;
}

/** The roles in the estate whose members can do the action. */
export function useWhoCanHelp(estateId: string, action: HelpAction) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: whoCanHelpQueryKey(userId, estateId, action),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET(
        "/estates/{estateId}/who-can-help",
        { params: { path: { estateId }, query: { action } } }
      );
      if (error || !data) {
        throw new Error("Couldn't find who can help.");
      }
      return data.roles;
    },
  });
}
