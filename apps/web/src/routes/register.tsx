import { createFileRoute } from "@tanstack/react-router";

interface RegisterSearch {
  error?: string;
}

export const Route = createFileRoute("/register")({
  component: RegisterRoute,
  head: () => ({ meta: [{ title: "Create an account" }] }),
  validateSearch: (search: Record<string, unknown>): RegisterSearch => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
});

function RegisterRoute() {
  const { error } = Route.useSearch();
  return <RegistrationPage error={error} />;
}

export function RegistrationPage({ error }: { error?: string } = {}) {
  return (
    <main className="flex items-center justify-center px-4 py-12">
      <section
        aria-labelledby="registration-heading"
        className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm sm:p-8"
      >
        <h1 className="font-semibold text-2xl" id="registration-heading">
          Create an account
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Create your UpKeep account through our secure authentication provider.
        </p>
        {error ? (
          <p className="mt-6 text-destructive text-sm" role="alert">
            Registration is temporarily unavailable. Please try again.
          </p>
        ) : null}
        <a
          className="mt-8 inline-flex h-10 w-full items-center justify-center bg-primary px-4 font-medium text-primary-foreground text-sm hover:bg-primary/80"
          href="/api/auth/sign-up"
        >
          Create account
        </a>
      </section>
    </main>
  );
}
