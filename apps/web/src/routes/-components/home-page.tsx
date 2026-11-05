import { buttonVariants } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import {
  Building2,
  ClipboardPenLine,
  Layers,
  LayoutDashboard,
  LogIn,
  Plus,
  Users,
} from "lucide-react";
import { useCallback } from "react";
import { isResidentOnly } from "@/components/app-navigation";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { useAppAccess } from "@/lib/access";
import { ResidentHome } from "@/routes/-components/resident-home";
import { SystemStatus } from "@/routes/-components/system-status";

export function HomePage() {
  const { user, loading } = useAuth();
  const access = useAppAccess();
  const retryAccess = useCallback(() => {
    access.refetch();
  }, [access]);
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
        <ErrorState message={access.error.message} onRetry={retryAccess} />
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
          description="Create an estate or accept an invitation"
          icon={LayoutDashboard}
          title="Report a fault"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Link className={buttonVariants()} to="/reports/new">
            <ClipboardPenLine aria-hidden="true" />
            Report a fault
          </Link>
          {access.data.canCreateEstate ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              to="/estates/new"
            >
              <Plus aria-hidden="true" />
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
        description="Estates, equipment and council access"
        icon={LayoutDashboard}
        title="Your estate workspace"
      />
      <Card className="mb-8">
        <CardContent>
          <section>
            <p className="text-muted-foreground mb-5 max-w-xl leading-relaxed">
              Estates, assets and the people who manage them
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {loading ? <p role="status">Checking your sign-in…</p> : null}
              {loading || user ? null : (
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
            Locations and estate details
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Layers aria-hidden="true" className="text-primary mb-2 size-6" />
            <CardTitle>Assets</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Equipment, condition and lifecycle
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Users aria-hidden="true" className="text-primary mb-2 size-6" />
            <CardTitle>Council access</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Invitations and permissions
          </CardContent>
        </Card>
      </div>
      <SystemStatus />
    </PageLayout>
  );
}
