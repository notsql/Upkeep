import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ClipboardPenLine, LayoutDashboard, Plus } from "lucide-react";
import { PageHeader } from "@/components/page/page-header";
import { PageLayout } from "@/components/page/page-layout";

export function HomeNoWorkspace({
  canCreateEstate,
}: {
  canCreateEstate: boolean | undefined;
}) {
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
        {canCreateEstate ? (
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
