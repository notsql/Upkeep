import { Spinner } from "@proj/ui/components/spinner";
import { createFileRoute } from "@tanstack/react-router";
import { signOut } from "@workos/authkit-tanstack-react-start";

import { sanitizeReturnTo } from "@/lib/auth-redirect";

interface LogoutSearch {
  returnTo: string;
}

export const Route = createFileRoute("/logout/")({
  component: LogoutPage,
  loaderDeps: ({ search }) => ({ returnTo: search.returnTo }),
  loader: async ({ deps }) => {
    await signOut({ data: { returnTo: deps.returnTo } });
  },
  validateSearch: (search: Record<string, unknown>): LogoutSearch => ({
    returnTo: sanitizeReturnTo(search.returnTo),
  }),
});

function LogoutPage() {
  return (
    <p
      aria-label="Signing out"
      className="flex items-center gap-2 p-4"
      role="status"
    >
      <Spinner aria-hidden="true" />
      Signing out...
    </p>
  );
}
