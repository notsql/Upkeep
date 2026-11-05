import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { SearchX, Users } from "lucide-react";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { useFilterPanel } from "@/components/filter-bar";
import { LoadingState } from "@/components/loading-state";
import { ListPageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { SubNav } from "@/components/sub-nav";
import { useAppAccess, useAuthenticatedSession } from "@/lib/access";
import { useEstateMembers } from "@/lib/council-invitations";
import {
  useEstateRoleDefinitions,
  useEstateRolePermissions,
} from "@/lib/estate-roles";
import { useEstate } from "@/lib/estates";
import { OwnerInvitations } from "@/routes/_auth/estates/$estateId/council/-components/access-controls";
import { InviteMemberDialog } from "@/routes/_auth/estates/$estateId/council/-components/invitation-form";
import {
  emptyFilter,
  filterCount,
  isFiltered,
  type MemberFilter,
  MemberFilters,
  matchesFilter,
  OWNER_ROLE,
} from "@/routes/_auth/estates/$estateId/council/-components/member-filters";
import {
  presetOptions,
  type RoleOption,
} from "@/routes/_auth/estates/$estateId/council/-components/role-picker";
import { EstateMembersTable } from "./estate-members-table";

function MembersHeader({ count }: { count: number | undefined }) {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <h2>Members</h2>
        {count === undefined ? null : (
          <Badge variant="outline">{count} active</Badge>
        )}
      </CardTitle>
      <CardDescription>
        Each member has one role in this estate. The Owner is the Manager who
        holds ownership: only they can transfer ownership or deactivate the
        estate.
      </CardDescription>
    </CardHeader>
  );
}

function useRoleOptions(estateId: string) {
  const roles = useEstateRoleDefinitions(estateId);
  const catalogue = useEstateRolePermissions(estateId);
  const customOptions: RoleOption[] = (roles.data ?? []).map((role) => ({
    role: "CUSTOM",
    label: role.name,
    customRoleId: role.id,
    customRoleVersion: role.version,
    permissions: (catalogue.data ?? []).filter((entry) =>
      role.permissions.includes(entry.code)
    ),
  }));
  return {
    options: [...presetOptions, ...customOptions],
    error: roles.error ?? catalogue.error,
  };
}

function EstateMembers({
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
    <Card>
      <MembersHeader count={members.data?.length} />
      <CardContent className="space-y-3">
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
      </CardContent>
    </Card>
  );
}

function MembersWorkspace({
  estateId,
  permission,
  view,
}: {
  estateId: string;
  permission: components["schemas"]["EstateAccessResponse"];
  view: CouncilView;
}) {
  const [filter, setFilter] = useState<MemberFilter>(emptyFilter);
  const clear = useCallback(() => setFilter(emptyFilter), []);
  const activeCount = filterCount(filter);
  const panel = useFilterPanel(activeCount);
  const { options, error } = useRoleOptions(estateId);
  const roleFilters = [
    { value: OWNER_ROLE, label: "Owner" },
    ...options.map((option) => ({
      value: option.customRoleId ?? option.role,
      label: option.label,
    })),
  ];
  return (
    <>
      <ListPageHeader
        actions={
          permission.canInviteMembers ? (
            <InviteMemberDialog estateId={estateId} />
          ) : null
        }
        filters={{ activeCount, ...panel.toggleProps }}
        icon={Users}
        title="Members"
      />
      <SubNav
        items={[
          {
            exact: true,
            label: "Members",
            params: { estateId },
            to: "/estates/$estateId/council",
          },
          {
            label: "Pending invitations",
            params: { estateId },
            to: "/estates/$estateId/council/invitations",
          },
        ]}
        label="Member views"
      />
      <InactiveNote permission={permission} />
      <MemberFilters
        {...panel.barProps}
        filter={filter}
        onChange={setFilter}
        onClear={clear}
        roles={roleFilters}
      />
      {view === "members" ? (
        <EstateMembers
          estateId={estateId}
          filter={filter}
          onClear={clear}
          options={options}
          optionsError={error}
          permission={permission}
        />
      ) : (
        <OwnerInvitations
          estateId={estateId}
          filter={isFiltered(filter) ? filter : undefined}
          onClear={clear}
        />
      )}
    </>
  );
}

function InactiveNote({
  permission,
}: {
  permission: components["schemas"]["EstateAccessResponse"];
}) {
  return permission.canInviteMembers ? null : (
    <p className="text-muted-foreground text-sm">
      This estate is inactive. New invitations are disabled.
    </p>
  );
}

export type CouncilView = "members" | "invitations";

/**
 * The Members section: header, sub-navigation and filters shared by the
 * members route (`council/`) and the pending-invitations route
 * (`council/invitations/`), which pass `view`.
 */
export function CouncilPage({
  estateId,
  view = "members",
}: {
  estateId: string;
  view?: CouncilView;
}) {
  const access = useAppAccess();
  const { ready } = useAuthenticatedSession();
  const retry = useCallback(() => {
    access.refetch();
  }, [access]);
  const permission = access.data?.estates?.find(
    (estate) => estate.estateId === estateId
  );
  if (!ready || access.isPending) {
    return (
      <PageLayout>
        <LoadingState label="Loading estate access…" rows={2} />
      </PageLayout>
    );
  }
  if (access.error) {
    return (
      <PageLayout>
        <ErrorState
          message={access.error.message}
          onRetry={retry}
          retryLabel="Retry access"
        />
      </PageLayout>
    );
  }
  const manager = permission?.canManageInvitationPermissions === true;
  if (
    !(
      permission &&
      (permission.canViewEstateInvitations ||
        permission.canInviteMembers ||
        manager)
    )
  ) {
    return (
      <PageLayout>
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            You do not have permission to invite members to this estate.
          </AlertDescription>
        </Alert>
      </PageLayout>
    );
  }
  return (
    <PageLayout className="space-y-6">
      {manager ? (
        <MembersWorkspace
          estateId={estateId}
          permission={permission}
          view={view}
        />
      ) : (
        <>
          <ListPageHeader
            actions={
              permission.canInviteMembers ? (
                <InviteMemberDialog estateId={estateId} />
              ) : null
            }
            icon={Users}
            title="Invitations"
          />
          <InactiveNote permission={permission} />
          <OwnerInvitations estateId={estateId} />
        </>
      )}
    </PageLayout>
  );
}
