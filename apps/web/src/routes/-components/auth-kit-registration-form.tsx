import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { useAuth } from "@workos-inc/authkit-react";
import { useCallback, useState } from "react";

export function AuthKitRegistrationForm() {
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
