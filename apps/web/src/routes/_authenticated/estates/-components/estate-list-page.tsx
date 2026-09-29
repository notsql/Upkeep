import { Link } from "@tanstack/react-router";
import { type ChangeEvent, useCallback, useState } from "react";
import { type EstateStatus, useEstateList } from "@/lib/estates";

export function EstateListPage() {
  const [status, setStatus] = useState<EstateStatus>("ACTIVE");
  const estates = useEstateList(status);
  const changeStatus = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (value === "ACTIVE" || value === "INACTIVE" || value === "ALL") {
      setStatus(value);
    }
  }, []);
  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl">My estates</h1>
        <Link
          className="bg-primary px-4 py-2 text-primary-foreground text-sm"
          to="/estates/new"
        >
          Create estate
        </Link>
      </div>
      <p className="mt-2 text-muted-foreground">
        Estates you own, and estates an admin has shared with you.
      </p>
      <div className="my-6 flex items-center gap-3">
        <label htmlFor="estate-status">Status</label>
        <select
          className="border bg-background px-3 py-2"
          id="estate-status"
          onChange={changeStatus}
          value={status}
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ALL">All</option>
        </select>
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
          <li className="border bg-card p-5" key={estate.id}>
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
            <p className="mt-2 text-muted-foreground text-sm">{estate.code}</p>
            <p className="mt-3 text-sm">
              {estate.address}, {estate.postalCode}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
