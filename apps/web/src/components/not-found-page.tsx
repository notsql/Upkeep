import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { House, SearchX } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";

export function NotFoundPage() {
  return (
    <PageLayout>
      <PageHeader
        description="Moved or mistyped address"
        icon={SearchX}
        title="Page not found"
      />
      <Link className={buttonVariants()} to="/">
        <House aria-hidden="true" />
        Go to home
      </Link>
    </PageLayout>
  );
}
