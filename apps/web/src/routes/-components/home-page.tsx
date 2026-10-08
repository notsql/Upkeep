import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { buttonVariants } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { Building2, Layers, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useHealth } from "@/lib/health";
import { WorkspaceHome } from "@/routes/-components/workspace-home";

function SystemStatus() {
  const health = useHealth();
  let content = <p role="status">Checking availability…</p>;
  if (health.error) {
    content = (
      <Alert variant="destructive">
        <AlertDescription>System status is unavailable.</AlertDescription>
      </Alert>
    );
  } else if (!health.isPending) {
    content = (
      <p className="text-muted-foreground text-sm">
        Service: {health.data?.ok ? "Available" : "Unavailable"} · Data
        connection: {health.data?.database ? "Available" : "Unavailable"}
      </p>
    );
  }
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>System status</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
export function HomePage() {
  const { user, loading } = useAuth();
  if (user && !loading) {
    return <WorkspaceHome />;
  }
  return (
    <main className="page-layout">
      <PageHeader
        description="Keep estates, equipment and council access organised in one place."
        title="Your estate workspace"
      />
      <section className="section-surface mb-8">
        <p className="mb-5 max-w-xl text-muted-foreground leading-relaxed">
          A clear view of your estates, the assets within them, and the people
          who help manage them.
        </p>
        <div className="page-actions">
          {loading ? <p role="status">Checking your sign-in…</p> : null}
          {loading || user ? null : (
            <>
              <a className={buttonVariants()} href="/api/auth/sign-in">
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
      <div className="grid gap-5 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <Building2
              aria-hidden="true"
              className="mb-2 size-6 text-primary"
            />
            <CardTitle>Estates</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Locations and estate details, together in one workspace.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Layers aria-hidden="true" className="mb-2 size-6 text-primary" />
            <CardTitle>Assets</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Equipment, condition assessments and lifecycle history.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Users aria-hidden="true" className="mb-2 size-6 text-primary" />
            <CardTitle>Council access</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Invitations and estate access, with clear permissions.
          </CardContent>
        </Card>
      </div>
      <SystemStatus />
    </main>
  );
}
