import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { DetailCard } from "@/components/detail-card";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { pageHead } from "@/lib/page-title";

export const Route = createFileRoute("/_auth/account/")({
  component: AccountPage,
  head: () => pageHead("Your account"),
});

const authenticatedRoute = getRouteApi("/_auth");

function AccountPage() {
  const { user } = authenticatedRoute.useLoaderData();

  return (
    <PageLayout>
      <PageHeader
        description="Profile and sign-in identity"
        icon={UserRound}
        title="Your account"
      />
      <DetailCard className="mt-6">
        <div>
          <dt className="font-medium">Name</dt>
          <dd className="text-muted-foreground">
            {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
              "Not provided"}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Email</dt>
          <dd className="text-muted-foreground">{user.email}</dd>
        </div>
      </DetailCard>
    </PageLayout>
  );
}
