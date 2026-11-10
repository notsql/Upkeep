import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";

export function HomeSignInCard({
  loading,
  signedIn,
}: {
  loading: boolean;
  signedIn: boolean;
}) {
  return (
    <section className="mb-8">
      <p className="text-muted-foreground mb-5 max-w-xl leading-relaxed">
        Estates, assets and the people who manage them
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {loading ? <p role="status">Checking your sign-in…</p> : null}
        {loading || signedIn ? null : (
          <>
            <a className={buttonVariants()} href="/api/auth/sign-in">
              <LogIn aria-hidden="true" />
              Sign in
            </a>
            <Link
              className={buttonVariants({ variant: "outline" })}
              to="/register"
            >
              Create account
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
