import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Card } from "@proj/ui/components/card";
import { Empty } from "@proj/ui/components/empty";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";
import { PageHeader } from "@/components/page-header";
import { type EstateStatus, useEstateList } from "@/lib/estates";
import { InvitationAcceptance } from "@/routes/_auth/estates/-components/invitation-acceptance";
import { PendingInvitations } from "@/routes/_auth/estates/-components/pending-invitations";

const statusItems: { value: EstateStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ALL", label: "All" },
];

export function EstateListPage() {
  const [status, setStatus] = useState<EstateStatus>("ACTIVE");
  const estates = useEstateList(status);
  const changeStatus = useCallback((value: EstateStatus | null) => {
    if (value) {
      setStatus(value);
    }
  }, []);
  const retry = useCallback(() => estates.refetch(), [estates.refetch]);
  return (
    <main className="page-layout">
      <PageHeader
        actions={
          <Link className={buttonVariants()} to="/estates/new">
            Create estate
          </Link>
        }
        description="Estates you own or have access to."
        title="Estates"
      />
      <InvitationAcceptance />
      <PendingInvitations />
      <div className="my-6 flex items-center gap-3">
        <Label className="text-sm" htmlFor="estate-status">
          Status
        </Label>
        <Select items={statusItems} onValueChange={changeStatus} value={status}>
          <SelectTrigger id="estate-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {estates.isPending ? <p aria-live="polite">Loading estates…</p> : null}
      {estates.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {estates.error.message}
            <Button onClick={retry} variant="outline">
              Retry estates
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {estates.data?.length === 0 ? (
        <Empty className="mb-6 border border-dashed bg-card" role="status">
          {status === "ALL"
            ? "No estates yet. Create your first estate to get started."
            : `No ${status.toLowerCase()} estates.`}
        </Empty>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2">
        {estates.data?.map((estate) => (
          <li key={estate.id}>
            <Card className="h-full gap-0 px-5 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-medium text-lg">
                  <Link
                    className="underline-offset-4 hover:underline"
                    params={{ estateId: estate.id }}
                    to="/estates/$estateId"
                  >
                    {estate.name}
                  </Link>
                </h2>
                <div className="flex flex-wrap gap-2">
                  {estate.owned ? null : (
                    <Badge variant="secondary">Shared with you</Badge>
                  )}
                  <LifecycleStatusBadge
                    inactive={Boolean(estate.deactivatedAt)}
                    inactiveLabel="Inactive"
                  />
                </div>
              </div>
              <p className="mt-2 text-muted-foreground text-sm">
                {estate.code}
              </p>
              <p className="mt-3 text-sm">
                {estate.address}, {estate.postalCode}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
