import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";

export function NotFoundPage() {
  return (
    <PageLayout>
      <PageHeader
        description="This page may have moved or the address may be incorrect."
        title="Page not found"
      />
      <Link className={buttonVariants()} to="/">
        Go to home
      </Link>
    </PageLayout>
  );
}
