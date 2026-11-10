import { askSomeone, type HelpAction, useWhoCanHelp } from "@/lib/who-can-help";

/**
 * "Ask <who> to <doing>." in place of a button the reader can't use. A failed
 * lookup is not an error: it falls back to "someone who manages this estate".
 */
export function AskSomeoneLine({
  action,
  doing,
  estateId,
}: {
  action: HelpAction;
  /** What they'd ask for, e.g. "send crew". */
  doing: string;
  estateId: string;
}) {
  const who = useWhoCanHelp(estateId, action);
  if (who.isPending) {
    return null;
  }
  return (
    <p className="text-muted-foreground text-sm">
      {askSomeone(who.data ?? [], doing)}
    </p>
  );
}
