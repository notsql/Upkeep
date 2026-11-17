import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Notification } from "@/lib/notifications";

/** The headline for a warning; others lead with their summary. */
export function notificationTitle(
  notification: Notification
): string | undefined {
  if (notification.type === "ANOMALY") {
    return `${notification.assetName} may have a problem`;
  }
  if (notification.type === "CHECK_REQUESTED") {
    return `Please inspect ${notification.assetName}`;
  }
  if (notification.type === "CHECK_FAILED") {
    return `Crew found a problem with ${notification.assetName}`;
  }
  if (notification.type === "WORK_ORDER_ASSIGNED") {
    return `You've been given a job: ${notification.workOrderReference ?? "a work order"}`;
  }
}

/**
 * Where opening a notification goes: its work order, the inspection form for
 * someone sent to inspect, or else the asset. Shared by the inbox and the
 * bell's dropdown.
 */
export function NotificationRowLink({
  notification,
  onClick,
  className,
  children,
}: {
  notification: Notification;
  onClick: () => void;
  className: string;
  children: ReactNode;
}) {
  const { estateId, assetId, workOrderId } = notification;
  if (notification.type === "WORK_ORDER_ASSIGNED" && workOrderId) {
    return (
      <Link
        className={className}
        onClick={onClick}
        params={{ estateId, workOrderId }}
        to="/estates/$estateId/work-orders/$workOrderId"
      >
        {children}
      </Link>
    );
  }
  if (!assetId) {
    return <div className={className}>{children}</div>;
  }
  const params = { estateId, assetId };
  if (notification.type === "CHECK_REQUESTED") {
    return (
      <Link
        className={className}
        onClick={onClick}
        params={params}
        to="/estates/$estateId/assets/$assetId/inspections/new"
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      className={className}
      onClick={onClick}
      params={params}
      to="/estates/$estateId/assets/$assetId"
    >
      {children}
    </Link>
  );
}
