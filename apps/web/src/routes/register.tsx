import { env } from "@proj/env/web";
import { createFileRoute } from "@tanstack/react-router";

import { AuthKitRegistrationForm } from "@/routes/-components/auth-kit-registration-form";

export const Route = createFileRoute("/register")({
  component: RegistrationPage,
  head: () => ({ meta: [{ title: "Create an account" }] }),
});

export function RegistrationPage() {
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
        {env.VITE_WORKOS_CLIENT_ID ? (
          <AuthKitRegistrationForm />
        ) : (
          <p className="mt-8 text-destructive text-sm" role="alert">
            Registration is not configured. Please contact support.
          </p>
        )}
      </section>
    </main>
  );
}
