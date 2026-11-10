import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { SendCrewDialog } from "@/components/dispatch/send-crew-dialog";
import { AskSomeoneLine } from "@/components/who-can-help/ask-someone-line";
import {
  type DispatchRoute,
  useAssetCheck,
  useOpenWorkOrder,
} from "@/lib/equipment-dispatch";
import { formatDate } from "@/lib/format";

const SMALL = buttonVariants({ size: "sm" });

function SendContractor({
  assetId,
  estateId,
}: {
  assetId: string;
  estateId: string;
}) {
  const open = useOpenWorkOrder(estateId, assetId);
  if (open.isPending) {
    return null;
  }
  if (open.data) {
    return (
      <Link
        className="text-sm underline"
        params={{ estateId, workOrderId: open.data.id }}
        to="/estates/$estateId/work-orders/$workOrderId"
      >
        {`Contractor already sent · ${open.data.reference}`}
      </Link>
    );
  }
  return (
    <Link
      className={SMALL}
      params={{ estateId }}
      search={{ assetId, reason: "END_OF_LIFE" }}
      to="/estates/$estateId/work-orders/new"
    >
      Send a contractor
    </Link>
  );
}

function SendCrew({
  assetId,
  assetName,
  estateId,
}: {
  assetId: string;
  assetName: string;
  estateId: string;
}) {
  const [open, setOpen] = useState(false);
  const start = useCallback(() => setOpen(true), []);
  const { check, pending } = useAssetCheck(estateId, assetId);
  if (pending) {
    return null;
  }
  if (check?.result) {
    const outcome = check.result.outcome === "PASS" ? "Pass" : "Fail";
    return (
      <Button disabled size="sm" type="button" variant="outline">
        {`Inspected on ${formatDate(check.result.inspectedOn)} (${outcome})`}
      </Button>
    );
  }
  if (check) {
    const who = check.assignedToName
      ? `Sent to ${check.assignedToName}`
      : "On the check list";
    return (
      <p className="text-sm">{`${who} · due ${formatDate(check.dueOn)}`}</p>
    );
  }
  return (
    <>
      <Button onClick={start} size="sm" type="button">
        Send crew to inspect
      </Button>
      <SendCrewDialog
        assetId={assetId}
        assetName={assetName}
        estateId={estateId}
        onOpenChange={setOpen}
        open={open}
      />
    </>
  );
}

/**
 * The one "send" step for an equipment warning. The caller picks the route
 * from the warning's reason (see `dispatchRoute`).
 */
export function DispatchAction({
  assetId,
  assetName,
  canSend,
  estateId,
  route,
}: {
  assetId: string;
  assetName: string;
  /** The reader is an owner or Manager of an active estate. */
  canSend: boolean;
  estateId: string;
  route: DispatchRoute;
}) {
  if (!canSend) {
    return (
      <AskSomeoneLine
        action={route === "CREW" ? "SEND_CREW" : "SEND_CONTRACTOR"}
        doing={route === "CREW" ? "send crew" : "send a contractor"}
        estateId={estateId}
      />
    );
  }
  if (route === "CONTRACTOR") {
    return <SendContractor assetId={assetId} estateId={estateId} />;
  }
  return (
    <SendCrew assetId={assetId} assetName={assetName} estateId={estateId} />
  );
}
