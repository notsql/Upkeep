import { env } from "@proj/env/web";
import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@workos-inc/authkit-react";
import { useCallback, useState } from "react";

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

function AuthKitRegistrationForm() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(event.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(undefined);
      setIsSubmitting(true);

      try {
        await signUp({ loginHint: email });
      } catch {
        setError("Unable to start registration. Please try again.");
        setIsSubmitting(false);
      }
    },
    [email, signUp]
  );

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          autoComplete="email"
          className="h-10"
          disabled={isSubmitting}
          id="email"
          name="email"
          onChange={handleEmailChange}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </div>
      <p className="text-muted-foreground text-sm">
        WorkOS will securely collect your name and password, enforce the
        password policy, and verify your email address.
      </p>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="h-10 w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Redirecting..." : "Create account"}
      </Button>
    </form>
  );
}
