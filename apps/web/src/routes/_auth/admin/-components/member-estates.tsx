import { Card, CardContent } from "@proj/ui/components/card";
import { Checkbox } from "@proj/ui/components/checkbox";
import { Label } from "@proj/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";

import { api } from "@/lib/api";
import { formatMcst } from "@/lib/estates";

// Local mutation arguments; API request/response types remain inferred.
interface AccessChange {
  estateId: string;
  granted: boolean;
}

const accessQueryKey = (userId: string) =>
  ["admin", "estate-users", userId] as const;

function EstateOption({
  checked,
  children,
  disabled,
  estateId,
  onChange,
}: {
  checked: boolean;
  children: ReactNode;
  disabled: boolean;
  estateId: string;
  onChange: (estateId: string, granted: boolean) => void;
}) {
  const id = `member-estate-${estateId}`;
  const handleCheckedChange = useCallback(
    (granted: boolean) => onChange(estateId, granted),
    [estateId, onChange]
  );
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={handleCheckedChange}
      />
      <Label className="text-sm" htmlFor={id}>
        {children}
      </Label>
    </div>
  );
}

export function MemberEstates({
  name,
  userId,
  showTitle = true,
  onPendingChange,
}: {
  name: string;
  userId: string;
  showTitle?: boolean;
  onPendingChange?: (pending: boolean) => void;
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

  useEffect(() => {
    onPendingChange?.(change.isPending);
  }, [change.isPending, onPendingChange]);
  const { mutate } = change;
  const handleChange = useCallback(
    (estateId: string, granted: boolean) => mutate({ estateId, granted }),
    [mutate]
  );

  const retry = useCallback(() => {
    access.refetch();
  }, [access]);

  const section = (
    <section
      aria-label={showTitle ? undefined : `Estates for ${name}`}
      aria-labelledby={showTitle ? "member-estates-heading" : undefined}
      className={showTitle ? undefined : "grid gap-3"}
    >
      {showTitle ? (
        <h2 className="font-semibold" id="member-estates-heading">
          Estate access for {name}
        </h2>
      ) : null}
      <p className="text-muted-foreground mt-1 text-sm">
        {name} can view the estates ticked here. Owners always keep access to
        their own estates. Changes apply on their next request.
      </p>

      {access.error ? (
        <div className="mt-4">
          <ErrorState message={access.error.message} onRetry={retry} />
        </div>
      ) : null}
      {change.error ? (
        <p className="text-destructive mt-4 text-sm" role="alert">
          {change.error.message}
        </p>
      ) : null}

      {access.isPending ? (
        <div className="mt-4">
          <LoadingState label="Loading estates…" rows={2} />
        </div>
      ) : null}

      {access.data?.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No estates yet" />
        </div>
      ) : null}

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {access.data?.map((estate) => (
          <li key={estate.estateId}>
            <EstateOption
              checked={estate.owner || estate.granted}
              disabled={
                estate.owner ||
                estate.canManageGrant === false ||
                change.isPending
              }
              estateId={estate.estateId}
              onChange={handleChange}
            >
              {estate.name} ({formatMcst(estate.code)})
              {estate.owner ? " · Owner" : ""}
              {estate.membershipRole === "RESIDENT"
                ? " · Resident assignment (read-only)"
                : ""}
              {estate.active ? "" : " · Inactive"}
            </EstateOption>
          </li>
        ))}
      </ul>
    </section>
  );
  if (!showTitle) {
    return section;
  }
  return (
    <Card>
      <CardContent>{section}</CardContent>
    </Card>
  );
}
