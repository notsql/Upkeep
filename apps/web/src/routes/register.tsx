import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";

const passwordRequirements = [
  { label: "At least 8 characters", pattern: /.{8,}/s },
  { label: "An uppercase letter", pattern: /[A-Z]/ },
  { label: "A lowercase letter", pattern: /[a-z]/ },
  { label: "A number", pattern: /[0-9]/ },
  { label: "A special character", pattern: /[^A-Za-z0-9\s]/ },
];

export const Route = createFileRoute("/register")({
  component: RegistrationPage,
  head: () => ({ meta: [{ title: "Create an account" }] }),
});

export function RegistrationPage() {
  const [password, setPassword] = useState("");
  const isPasswordValid = passwordRequirements.every(({ pattern }) =>
    pattern.test(password)
  );

  const handlePasswordOnChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setPassword(value);
      event.target.setCustomValidity(
        passwordRequirements.every(({ pattern }) => pattern.test(value))
          ? ""
          : "Use at least 8 characters, including uppercase and lowercase letters, a number, and a special character."
      );
    },
    []
  );

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
          Enter your details to get started with UpKeep.
        </p>
        <form
          className="mt-8 space-y-5"
          // onSubmit={}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              autoComplete="email"
              className="h-10"
              id="email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              autoCapitalize="none"
              autoComplete="username"
              className="h-10"
              id="username"
              name="username"
              placeholder="Your username"
              required
              spellCheck={false}
              type="text"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              aria-describedby="password-requirements password-status"
              aria-invalid={password.length > 0 && !isPasswordValid}
              autoComplete="new-password"
              className="h-10"
              id="password"
              name="password"
              onChange={handlePasswordOnChange}
              placeholder="Create a password"
              required
              type="password"
              value={password}
            />
            <p className="text-sm" id="password-status" role="status">
              {password.length > 0 &&
                (isPasswordValid
                  ? "Password meets all requirements."
                  : "Password does not meet all requirements.")}
            </p>
          </div>
          <Button className="h-10 w-full" type="submit">
            Create account
          </Button>
        </form>
      </section>
    </main>
  );
}
