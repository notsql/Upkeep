import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useInspectionResults } from "@/lib/inspections";

/** Only opened after a save error to check canonical records before another POST. */
export function InspectionSaveRecovery({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const [checking, setChecking] = useState(false);
  const [cursor, setCursor] = useState<string>();
  const history = useInspectionResults(estateId, assetId, cursor, checking);
  const refresh = useCallback(() => {
    setChecking(true);
    history.refetch();
  }, [history.refetch]);
  const next = useCallback(
    () => setCursor(history.data?.nextCursor ?? undefined),
    [history.data?.nextCursor]
  );
  return (
    <section aria-label="Check inspection save" className="space-y-3">
      <Button onClick={refresh} type="button" variant="outline">
        Refresh inspection history
      </Button>
      {checking && history.isPending ? (
        <p role="status">Checking saved inspections…</p>
      ) : null}
      {checking && history.isError ? (
        <p>Inspection history is unavailable. Retry before submitting again.</p>
      ) : null}
      {checking && history.data ? (
        <>
          <p>Check these saved records before submitting again.</p>
          <ul className="space-y-2">
            {history.data.items.map((record) => (
              <li key={record.id}>
                <Link
                  className="underline"
                  params={{ estateId, assetId, inspectionId: record.id }}
                  to="/estates/$estateId/assets/$assetId/inspections/$inspectionId"
                >
                  {record.inspectedOn} ·{" "}
                  {record.outcome === "PASS" ? "Pass" : "Fail"} · View record
                </Link>
              </li>
            ))}
          </ul>
          {history.data.items.length === 0 ? (
            <p>No inspection records yet.</p>
          ) : null}
          {history.data.nextCursor ? (
            <Button onClick={next} type="button" variant="outline">
              Older records
            </Button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
