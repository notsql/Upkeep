import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { buttonVariants } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";

interface RegisterSearch {
  error?: string;
}

export const Route = createFileRoute("/register/")({
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
      <Card
        aria-labelledby="registration-heading"
        className="w-full max-w-md"
        role="region"
      >
        <CardHeader>
          <CardTitle>
            <h1 className="font-semibold text-2xl" id="registration-heading">
              Create an account
            </h1>
          </CardTitle>
          <CardDescription>
            Create your UpKeep account through our secure authentication
            provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>
                Registration is temporarily unavailable. Please try again.
              </AlertDescription>
            </Alert>
          ) : null}
          <a
            className={buttonVariants({ className: "w-full", size: "lg" })}
            href="/api/auth/sign-up"
          >
            Create account
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
