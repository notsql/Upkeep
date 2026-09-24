import { Button } from "@proj/ui/components/button";
import { useAuth } from "@workos-inc/authkit-react";
import { useCallback, useEffect, useState } from "react";

export function AuthKitLogin({ returnTo }: { returnTo: string }) {
  const { signIn } = useAuth();
  const [error, setError] = useState<string>();

  const startSignIn = useCallback(async () => {
    setError(undefined);
    try {
      await signIn({ state: { returnTo } });
    } catch {
      setError("Unable to start sign in. Please try again.");
    }
  }, [returnTo, signIn]);

  useEffect(() => {
    startSignIn().catch(() => undefined);
  }, [startSignIn]);

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
        <Button onClick={startSignIn} type="button">
          Try again
        </Button>
      </div>
    );
  }

  return (
    <p aria-label="Redirecting to sign in" role="status">
      Redirecting to secure sign in...
    </p>
  );
}
