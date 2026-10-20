import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { useResidentContext } from "@/lib/reports";
import { NewReportForm } from "@/routes/_auth/reports/new/-components/new-report-form";

export function NewReportPage() {
  const context = useResidentContext();

  return (
    <main className="page-layout">
      {context.data ? (
        <h1 className="mb-4 font-semibold text-2xl">Report a fault</h1>
      ) : null}
      {context.isPending ? <p role="status">Loading your estate…</p> : null}
      {context.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            Unable to load your estate assignment. Please try again.
          </AlertDescription>
        </Alert>
      ) : null}
      {context.data && !context.data.canSubmit ? (
        <Alert role="alert">
          <AlertDescription>
            You have no estate assigned. Contact your estate manager before
            reporting a fault.
          </AlertDescription>
        </Alert>
      ) : null}
      {context.data?.canSubmit ? (
        <NewReportForm estates={context.data.estates} />
      ) : null}
    </main>
  );
}
