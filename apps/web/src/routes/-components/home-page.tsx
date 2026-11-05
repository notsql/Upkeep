import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { LayoutDashboard } from "lucide-react";
import { useCallback } from "react";
import { isResidentOnly } from "@/components/app-navigation";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { useAppAccess } from "@/lib/access";
import { HomeFeatureCards } from "@/routes/-components/home-feature-cards";
import { HomeNoWorkspace } from "@/routes/-components/home-no-workspace";
import { HomeSignInCard } from "@/routes/-components/home-sign-in-card";
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
    return <HomeNoWorkspace canCreateEstate={access.data.canCreateEstate} />;
  }
  return (
    <PageLayout>
      <PageHeader
        description="Estates, equipment and council access"
        icon={LayoutDashboard}
        title="Your estate workspace"
      />
      <HomeSignInCard loading={loading} signedIn={Boolean(user)} />
      <HomeFeatureCards />
      <SystemStatus />
    </PageLayout>
  );
}
