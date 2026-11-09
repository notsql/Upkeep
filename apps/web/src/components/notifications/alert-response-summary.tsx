import type { Notification } from "@/lib/notifications";

type Anomaly = NonNullable<Notification["anomaly"]>;

/** Who acknowledged or dismissed an anomaly alert, when and why (ID-107). */
export function AlertResponseSummary({ anomaly }: { anomaly: Anomaly }) {
  if (anomaly.response === "NONE") {
    return <p className="text-muted-foreground text-sm">Not seen yet</p>;
  }
  const verb =
    anomaly.response === "DISMISSED" ? "Dismissed" : "Marked as seen";
  const who = anomaly.respondedByName ?? "Unknown user";
  const when = anomaly.respondedAt
    ? ` on ${new Date(anomaly.respondedAt).toLocaleString()}`
    : "";
  const why = anomaly.responseReason ? `: ${anomaly.responseReason}` : "";
  return <p className="text-sm">{`${verb} by ${who}${when}${why}`}</p>;
}
