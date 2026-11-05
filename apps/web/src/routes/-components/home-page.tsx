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
import { isResidentOnly, useCurrentEstate } from "@/components/app-navigation";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { useAppAccess } from "@/lib/access";
import { useHealth } from "@/lib/health";
import { ResidentDashboard } from "@/routes/-components/resident-dashboard";

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
function ResidentHome() {
  const { estateId } = useCurrentEstate();
  return <ResidentDashboard estateId={estateId} />;
}

export function HomePage() {
  const { user, loading } = useAuth();
  const access = useAppAccess();
  if (user && !loading && access.isPending) {
    return (
      <PageLayout>
        <LoadingState label="Loading your access…" rows={2} />
      </PageLayout>
    );
  }
  if (user && !loading && access.isError) {
    return (
      <PageLayout>
        <Alert role="alert" variant="destructive">
          <AlertDescription>{access.error.message}</AlertDescription>
        </Alert>
      </PageLayout>
    );
  }
  if (user && !loading && isResidentOnly(access.data)) {
    return <ResidentHome />;
  }
  if (user && !loading && access.data && !access.data.canEnterWorkspace) {
    return (
      <PageLayout>
        <PageHeader
          description="Create your first estate or accept an invitation to join one."
          title="Report a fault"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Link className={buttonVariants()} to="/reports/new">
            Report a fault
          </Link>
          {access.data.canCreateEstate ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              to="/estates/new"
            >
              Create estate
            </Link>
          ) : null}
        </div>
      </PageLayout>
    );
  }
  return (
    <PageLayout>
      <PageHeader
        description="Keep estates, equipment and council access organised in one place."
        title="Your estate workspace"
      />
      <Card className="mb-8">
        <CardContent>
          <section>
            <p className="text-muted-foreground mb-5 max-w-xl leading-relaxed">
              A clear view of your estates, the assets within them, and the
              people who help manage them.
            </p>
            <div className="flex flex-wrap items-center gap-3">
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
        </CardContent>
      </Card>
      <div className="grid gap-5 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <Building2
              aria-hidden="true"
              className="text-primary mb-2 size-6"
            />
            <CardTitle>Estates</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Locations and estate details, together in one workspace.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Layers aria-hidden="true" className="text-primary mb-2 size-6" />
            <CardTitle>Assets</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Equipment, condition assessments and lifecycle history.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Users aria-hidden="true" className="text-primary mb-2 size-6" />
            <CardTitle>Council access</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Invitations and estate access, with clear permissions.
          </CardContent>
        </Card>
      </div>
      <SystemStatus />
    </PageLayout>
  );
}
