import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { buttonVariants } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { buildSignInPath } from "@/lib/auth-redirect";

export function LoginPage({
  error,
  returnTo = "/",
}: {
  error?: string;
  returnTo?: string;
}) {
  return (
    <main className="flex items-center justify-center px-4 py-12">
      <Card
        aria-labelledby="login-heading"
        className="w-full max-w-md"
        role="region"
      >
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-semibold" id="login-heading">
              Sign in
            </h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {error === "auth_unavailable"
                  ? "Authentication is temporarily unavailable. Please try again."
                  : "Authentication failed or expired. Please try again."}
              </AlertDescription>
            </Alert>
          ) : null}
          <a
            className={buttonVariants({ className: "w-full", size: "lg" })}
            href={buildSignInPath(returnTo)}
          >
            Continue to secure sign in
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
