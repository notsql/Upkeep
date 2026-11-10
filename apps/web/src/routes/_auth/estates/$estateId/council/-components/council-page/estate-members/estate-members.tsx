import type { components } from "@proj/api/schema";
import { Button } from "@proj/ui/components/button";
import { SearchX, Users } from "lucide-react";
import { useCallback } from "react";
import { PageSection } from "@/components/page/section-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useAuthenticatedSession } from "@/lib/access";
import { useEstateMembers } from "@/lib/council-invitations";
import { useEstate } from "@/lib/estates";
import { EstateMembersTable } from "@/routes/_auth/estates/$estateId/council/-components/council-page/estate-members/estate-members-table";
import {
  type MemberFilter,
  matchesFilter,
  OWNER_ROLE,
} from "@/routes/_auth/estates/$estateId/council/-components/council-page/member-filters";
import type { RoleOption } from "@/routes/_auth/estates/$estateId/council/-components/council-page/role-picker";

export function EstateMembers({
  estateId,
  permission,
  filter,
  options,
  optionsError,
  onClear,
}: {
  estateId: string;
  permission: components["schemas"]["EstateAccessResponse"];
  filter: MemberFilter;
  options: RoleOption[];
  optionsError: Error | null;
  onClear: () => void;
}) {
  const { userId } = useAuthenticatedSession();
  const estate = useEstate(estateId);
  const members = useEstateMembers(estateId, true);
  const visible = (members.data ?? []).filter((member) =>
    matchesFilter(filter, {
      text: [member.name, member.email],
      role: member.owner ? OWNER_ROLE : (member.customRoleId ?? member.role),
    })
  );
  const loadError = members.error ?? estate.error ?? optionsError;
  const canReassign =
    (permission.canReassignRoles ?? true) && !estate.data?.deactivatedAt;
  const showTable = !members.isError && visible.length > 0;
  const retry = useCallback(() => {
    members.refetch();
    estate.refetch();
  }, [members, estate]);
  return (
    <PageSection
      description="Each member has one role in this estate. The Owner is the Manager who holds ownership: only they can transfer ownership or deactivate the estate."
      title="Members"
    >
      {canReassign ? null : (
        <p className="text-muted-foreground text-sm">
          This estate is inactive. Reactivation is required before changing
          member roles.
        </p>
      )}
      {members.isPending ? (
        <LoadingState label="Loading members…" variant="table" />
      ) : null}
      {loadError ? (
        <ErrorState message={loadError.message} onRetry={retry} />
      ) : null}
      {members.data?.length === 0 ? (
        <EmptyState
          description="Invited members appear here"
          fill
          icon={Users}
          title="No members yet"
        />
      ) : null}
      {members.data?.length && !visible.length ? (
        <EmptyState
          action={
            <Button onClick={onClear} variant="outline">
              Clear filters
            </Button>
          }
          description="Try another search or role"
          fill
          icon={SearchX}
          title="No matching members"
        />
      ) : null}
      {showTable ? (
        <EstateMembersTable
          canReassign={canReassign}
          canTransfer={estate.data?.owned === true}
          estateId={estateId}
          key={`${estateId}:${userId}`}
          members={visible}
          options={options}
        />
      ) : null}
    </PageSection>
  );
}
