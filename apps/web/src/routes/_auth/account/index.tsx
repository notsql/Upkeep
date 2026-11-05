import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { DetailCard } from "@/components/detail-card";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";

export const Route = createFileRoute("/_auth/account/")({
  component: AccountPage,
  head: () => ({ meta: [{ title: "Your account" }] }),
});

const authenticatedRoute = getRouteApi("/_auth");

function AccountPage() {
  const { user } = authenticatedRoute.useLoaderData();

  return (
    <PageLayout>
      <PageHeader
        description="Your profile and sign-in identity."
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
