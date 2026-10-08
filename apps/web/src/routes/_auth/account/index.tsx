import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_auth/account/")({
  component: AccountPage,
  head: () => ({ meta: [{ title: "Your account" }] }),
});

const authenticatedRoute = getRouteApi("/_auth");

function AccountPage() {
  const { user } = authenticatedRoute.useLoaderData();

  return (
    <main className="page-layout">
      <PageHeader
        breadcrumbs={[{ label: "Home", to: "/" }, { label: "Account" }]}
        description="Your profile and sign-in identity."
        title="Your account"
      />
      <dl className="detail-grid mt-6">
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
      </dl>
    </main>
  );
}
