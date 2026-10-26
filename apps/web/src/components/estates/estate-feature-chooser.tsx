import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { useCallback } from "react";
import { useAppAccess } from "@/lib/access";
import type { EstateFeature } from "./estate-feature-switcher";

export function EstateFeatureChooser({
  open,
  onOpenChange,
  feature,
}: {
  feature: EstateFeature;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const access = useAppAccess();
  const destinations = {
    reports: {
      label: "fault reports",
      path: "/estates/$estateId/reports",
      capability: "canViewFaultReports",
    },
    documents: {
      label: "documents",
      path: "/estates/$estateId/documents",
      capability: "canViewDocuments",
    },
    "work-orders": {
      label: "work orders",
      path: "/estates/$estateId/work-orders",
      capability: "canViewWorkOrders",
    },
  } as const;
  const { label, path: destination, capability } = destinations[feature];
  const choices = access.isError
    ? []
    : (access.data?.estates.filter((estate) => estate[capability]) ?? []);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const retry = useCallback(() => access.refetch(), [access.refetch]);
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose an estate for {label}</DialogTitle>
          <DialogDescription>
            Select the estate whose {label} you want to open.
          </DialogDescription>
        </DialogHeader>
        {access.isPending ? <p role="status">Loading estates…</p> : null}
        {access.isError ? (
          <p role="alert">
            Unable to load estates.{" "}
            <Button onClick={retry} variant="outline">
              Retry
            </Button>
          </p>
        ) : null}
        {!(access.isPending || access.isError) && choices.length === 0 ? (
          <p>No estates with access to {label}.</p>
        ) : null}
        <div className="grid max-h-80 gap-2 overflow-y-auto">
          {choices.map((estate) => (
            <Link
              className="flex min-h-11 items-center gap-3 rounded-xl border p-3 hover:bg-accent"
              key={estate.estateId}
              onClick={close}
              params={{ estateId: estate.estateId }}
              search={{}}
              to={destination}
            >
              <Building2 aria-hidden="true" className="size-4 shrink-0" />
              <span>{estate.estateName}</span>
            </Link>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
