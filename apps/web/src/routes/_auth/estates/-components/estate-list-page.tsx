import { buttonVariants } from "@proj/ui/components/button";
import { Card } from "@proj/ui/components/card";
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
  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl">My estates</h1>
        <Link className={buttonVariants()} to="/estates/new">
          Create estate
        </Link>
      </div>
      <InvitationAcceptance />
      <PendingInvitations />
      <p className="mt-2 text-muted-foreground">
        Estates you own, and estates an admin has shared with you.
      </p>
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
        <p className="text-destructive" role="alert">
          {estates.error.message}
        </p>
      ) : null}
      {estates.data?.length === 0 ? (
        <p className="border p-8 text-muted-foreground" role="status">
          {status === "ALL"
            ? "No estates yet. Create your first estate to get started."
            : `No ${status.toLowerCase()} estates.`}
        </p>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2">
        {estates.data?.map((estate) => (
          <li key={estate.id}>
            <Card className="h-full gap-0 px-5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-medium text-lg">
                  <Link
                    className="underline-offset-4 hover:underline"
                    params={{ estateId: estate.id }}
                    to="/estates/$estateId"
                  >
                    {estate.name}
                  </Link>
                </h2>
                <div className="flex gap-2">
                  {estate.owned ? null : (
                    <span className="border px-2 py-1 text-xs">
                      Shared with you
                    </span>
                  )}
                  <span className="border px-2 py-1 text-xs">
                    {estate.deactivatedAt ? "Inactive" : "Active"}
                  </span>
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
