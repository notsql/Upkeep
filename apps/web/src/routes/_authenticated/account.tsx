import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@workos-inc/authkit-react";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
  head: () => ({ meta: [{ title: "Your account" }] }),
});

function AccountPage() {
  const { user } = useAuth();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-semibold text-2xl">Your account</h1>
      <dl className="mt-6 grid gap-2">
        <div>
          <dt className="font-medium">Name</dt>
          <dd className="text-muted-foreground">
            {[user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
              "Not provided"}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Email</dt>
          <dd className="text-muted-foreground">{user?.email}</dd>
        </div>
      </dl>
    </main>
  );
}
