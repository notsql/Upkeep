import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ClipboardPenLine } from "lucide-react";

export function ReportFaultLink({ estateId }: { estateId?: string }) {
  return (
    <Link
      className={buttonVariants()}
      search={estateId ? { estateId } : {}}
      to="/reports/new"
    >
      <ClipboardPenLine aria-hidden="true" />
      Report a fault
    </Link>
  );
}
