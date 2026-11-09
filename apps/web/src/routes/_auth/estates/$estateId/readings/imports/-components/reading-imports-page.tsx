import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { Upload } from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { FormActions } from "@/components/forms/form-actions";
import { FormPageHeader } from "@/components/page/form-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { SectionCard } from "@/components/page/section-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Pagination } from "@/components/table/pagination";
import { useAppAccess } from "@/lib/access";
import { importPreset, readImportSample } from "@/lib/reading-import-preview";
import {
  type ReadingImportOptions,
  readingImportMessage,
  useImportReadings,
  useReadingImports,
} from "@/lib/reading-imports";
import { ImportFormFields } from "@/routes/_auth/estates/$estateId/readings/imports/-components/import-form-fields";
import { ImportHistory } from "@/routes/_auth/estates/$estateId/readings/imports/-components/import-history";

interface SubmissionIdentity {
  file: File;
  fingerprint: string;
  id: string;
}
function submissionIdentity(
  previous: SubmissionIdentity | null,
  file: File,
  fingerprint: string
): SubmissionIdentity {
  if (previous?.file === file && previous.fingerprint === fingerprint) {
    return previous;
  }
  return { file, fingerprint, id: crypto.randomUUID() };
}
function mappingFromHeaders(
  headers: string[],
  lookup: string
): Record<string, string> {
  return Object.fromEntries(
    [lookup, "metric", "measured_at", "value", "unit"]
      .filter((field) => headers.includes(field))
      .map((field) => [field, field])
  );
}
function validMapping(
  source: string,
  sample: string[][],
  mapping: Record<string, string>,
  mode: string
) {
  const columns = Object.values(mapping).filter(Boolean);
  return (
    Boolean(source.trim()) &&
    source.length <= 200 &&
    sample.length >= 2 &&
    [mode, "metric", "measured_at", "value"].every((key) =>
      Boolean(mapping[key])
    ) &&
    new Set(columns).size === columns.length
  );
}
export function ReadingImportsPage({ estateId }: { estateId: string }) {
  const { user } = useAuth();
  const access = useAppAccess();
  const navigate = useNavigate();
  const permission = access.data?.estates.find(
    (estate) => estate.estateId === estateId
  );
  const allowed = Boolean(permission?.canImportReadings);
  const canRead = Boolean(allowed || permission?.role === "MANAGER");
  const [page, setPage] = useState(0);
  const history = useReadingImports(estateId, page, canRead);
  const mutation = useImportReadings(estateId);
  const [file, setFile] = useState<File>();
  const [source, setSource] = useState("");
  const [sample, setSample] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mode, setMode] = useState("asset_reference");
  const [error, setError] = useState("");
  const scope = `${user?.id}:${estateId}`;
  const current = useRef(scope);
  current.current = scope;
  const active = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const selected = useRef<File | undefined>(undefined);
  const identity = useRef<{
    file: File;
    fingerprint: string;
    id: string;
  } | null>(null);
  const resetMutation = mutation.reset;
  useEffect(() => {
    if (current.current !== scope) {
      return;
    }
    resetMutation();
    setSource("");
    setPage(0);
    setFile(undefined);
    setSample([]);
    setMapping({});
    setError("");
    identity.current = null;
    return () => {
      active.current?.abort();
      busy.current = false;
      selected.current = undefined;
    };
  }, [scope, resetMutation]);
  useEffect(() => {
    if (!allowed) {
      active.current?.abort();
      busy.current = false;
    }
  }, [allowed]);

  const choose = useCallback(
    async (next: File | undefined) => {
      selected.current = next;
      setFile(next);
      setSample([]);
      setError("");
      if (!next) {
        return;
      }
      try {
        const preview = await readImportSample(next);
        if (current.current !== scope || selected.current !== next) {
          return;
        }
        setSample(preview);
        const [headers] = preview;
        const lookup = headers.includes("asset_id")
          ? "asset_id"
          : "asset_reference";
        setMode(lookup);
        setMapping(mappingFromHeaders(headers, lookup));
      } catch (cause) {
        if (current.current === scope && selected.current === next) {
          setError(
            readingImportMessage(
              cause,
              "Couldn't read the file. Make sure it's a CSV and try again."
            )
          );
        }
      }
    },
    [scope]
  );
  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (busy.current || !allowed) {
        return;
      }
      if (!(file && validMapping(source, sample, mapping, mode))) {
        setError(
          "Choose a file, give it a name, and match each column in your file."
        );
        return;
      }
      const normalized = Object.fromEntries(
        Object.entries(mapping)
          .filter(([, value]) => Boolean(value))
          .sort(([a], [b]) => a.localeCompare(b))
      );
      const fingerprint = JSON.stringify([source, mode, normalized]);
      identity.current = submissionIdentity(
        identity.current,
        file,
        fingerprint
      );
      const options: ReadingImportOptions = {
        submissionId: identity.current.id,
        sourceLabel: source,
        preset: importPreset(sample[0]),
        assetLookupMode: mode,
        mapping: normalized,
      };
      const controller = new AbortController();
      active.current = controller;
      busy.current = true;
      setError("");
      try {
        const batch = await mutation.mutateAsync({
          file,
          options,
          signal: controller.signal,
        });
        if (controller.signal.aborted || current.current !== scope) {
          return;
        }
        toast.success("CSV import completed.");
        await navigate({
          to: "/estates/$estateId/readings/imports/$batchId",
          params: { estateId, batchId: batch.id },
        });
      } catch (cause) {
        if (!controller.signal.aborted && current.current === scope) {
          setError(
            readingImportMessage(
              cause,
              "Import completion could not be confirmed. Check batch history, then retry with the same input."
            )
          );
        }
      } finally {
        if (active.current === controller) {
          busy.current = false;
          active.current = null;
        }
      }
    },
    [
      allowed,
      file,
      source,
      sample,
      mapping,
      mode,
      scope,
      mutation.mutateAsync,
      navigate,
      estateId,
    ]
  );

  const nextPage = useCallback(() => {
    setPage((value) => value + 1);
  }, []);
  const previousPage = useCallback(() => {
    setPage((value) => value - 1);
  }, []);
  const retryHistory = useCallback(() => {
    history.refetch();
  }, [history.refetch]);
  if (access.data && !allowed && !canRead) {
    return (
      <Alert>
        <AlertDescription>
          Import CSV is unavailable for this estate. If the estate is inactive,
          import and rollback are disabled.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <PageLayout className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <FormPageHeader
        breadcrumbs={[
          {
            label: "Readings",
            to: "/estates/$estateId/readings",
            params: { estateId },
          },
          { label: "Import CSV" },
        ]}
        icon={Upload}
        title="Import CSV"
      />
      {allowed ? (
        <Card className="max-w-3xl">
          <CardContent>
            <form
              aria-label="Import historical readings"
              className="space-y-6"
              noValidate
              onSubmit={submit}
            >
              <fieldset
                className="min-w-0 space-y-5"
                disabled={mutation.isPending}
              >
                <ImportFormFields
                  error={error}
                  mapping={mapping}
                  mode={mode}
                  onChoose={choose}
                  sample={sample}
                  setMapping={setMapping}
                  setMode={setMode}
                  setSource={setSource}
                  source={source}
                />
              </fieldset>
              {error ? (
                <Alert id="import-error" variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex flex-wrap items-end gap-3">
                <FormActions
                  label={mutation.isPending ? "Importing…" : "Import"}
                  pending={mutation.isPending}
                />
                <Button
                  disabled={mutation.isPending}
                  render={
                    <Link
                      params={{ estateId }}
                      to="/estates/$estateId/readings"
                    />
                  }
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertDescription>
            This estate is inactive. Import and rollback are unavailable.
          </AlertDescription>
        </Alert>
      )}
      <SectionCard title="Batch history">
        {history.isPending && canRead ? (
          <LoadingState label="Loading import history…" rows={3} />
        ) : null}
        {history.error ? (
          <ErrorState message={history.error.message} onRetry={retryHistory} />
        ) : null}
        {history.data?.items.length === 0 ? (
          <EmptyState icon={Upload} title="No import batches yet" />
        ) : null}
        <ImportHistory estateId={estateId} items={history.data?.items ?? []} />
        {history.data ? (
          <Pagination
            canNext={(page + 1) * history.data.size < history.data.totalItems}
            canPrevious={page > 0}
            label="Import history pages"
            onNext={nextPage}
            onPrevious={previousPage}
            summary={`${history.data.totalItems} batches`}
          />
        ) : null}
      </SectionCard>
    </PageLayout>
  );
}
