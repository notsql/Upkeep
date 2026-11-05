import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { LayoutDashboard } from "lucide-react";
import { useCallback } from "react";
import { PageHeader } from "@/components/page/page-header";
import { PageLayout } from "@/components/page/page-layout";
import { isResidentOnly } from "@/components/shell/app-navigation";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useAppAccess } from "@/lib/access";
import { HomeFeatureCards } from "@/routes/-components/home-page/home-feature-cards";
import { HomeNoWorkspace } from "@/routes/-components/home-page/home-no-workspace";
import { HomeSignInCard } from "@/routes/-components/home-page/home-sign-in-card";
import { ResidentHome } from "@/routes/-components/home-page/resident-home/resident-home";
import { SystemStatus } from "@/routes/-components/home-page/system-status";

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
