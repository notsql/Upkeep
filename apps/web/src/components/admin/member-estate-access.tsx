import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useCallback } from "react";

import { api } from "@/lib/api";

// Local mutation arguments; API request/response types remain inferred.
interface AccessChange {
  estateId: string;
  granted: boolean;
}

const accessQueryKey = (userId: string) =>
  ["admin", "estate-access", userId] as const;

export function MemberEstateAccess({
  name,
  userId,
}: {
  name: string;
  userId: string;
}) {
  const queryClient = useQueryClient();

  const access = useQuery({
    queryKey: accessQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await api.GET(
        "/api/admin/users/{userId}/estates",
        { params: { path: { userId } } }
      );
      if (error || !data) {
        throw new Error("Unable to load estate access");
      }
      return data;
    },
  });

  const change = useMutation({
    mutationFn: async ({ estateId, granted }: AccessChange) => {
      const options = { params: { path: { userId, estateId } } };
      const { error } = granted
        ? await api.PUT("/api/admin/users/{userId}/estates/{estateId}", options)
        : await api.DELETE(
            "/api/admin/users/{userId}/estates/{estateId}",
            options
          );
      if (error) {
        throw new Error("Unable to update estate access");
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: accessQueryKey(userId),
        exact: true,
      }),
  });

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { checked, dataset } = event.target;
      if (dataset.estateId) {
        change.mutate({ estateId: dataset.estateId, granted: checked });
      }
    },
    [change]
  );

  const error = access.error ?? change.error;

  return (
    <section
      aria-labelledby="estate-access-heading"
      className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
    >
      <h2 className="font-semibold" id="estate-access-heading">
        Estate access for {name}
      </h2>
      <p className="mt-1 text-muted-foreground text-sm">
        {name} can view the estates ticked here. Owners always keep access to
        their own estates. Changes apply on their next request.
      </p>

      {error ? (
        <p
          className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
          role="alert"
        >
          {error.message}
        </p>
      ) : null}

      {access.isPending ? (
        <p className="mt-4" role="status">
          Loading estates…
        </p>
      ) : null}

      {access.data?.length === 0 ? (
        <p className="mt-4 text-muted-foreground text-sm">No estates yet.</p>
      ) : null}

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {access.data?.map((estate) => (
          <li key={estate.estateId}>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={estate.owner || estate.granted}
                data-estate-id={estate.estateId}
                disabled={estate.owner || change.isPending}
                onChange={handleChange}
                type="checkbox"
              />
              <span>
                {estate.name} ({estate.code}){estate.owner ? " · Owner" : ""}
                {estate.active ? "" : " · Inactive"}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
