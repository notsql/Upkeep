import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@proj/ui/components/tabs";
import { Users } from "lucide-react";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { useAppAccess, useAuthenticatedSession } from "@/lib/access";
import {
  useEstateMembers,
  useOutstandingInvitations,
} from "@/lib/council-invitations";
import {
  useEstateRoleDefinitions,
  useEstateRolePermissions,
} from "@/lib/estate-roles";
import { useEstate } from "@/lib/estates";
import { OwnerInvitations } from "@/routes/_auth/estates/$estateId/council/-components/access-controls";
import { InviteMemberDialog } from "@/routes/_auth/estates/$estateId/council/-components/invitation-form";
import {
  emptyFilter,
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
  onClearFilters,
}: {
  estateId: string;
  permission: components["schemas"]["EstateAccessResponse"];
  filter: MemberFilter;
  options: RoleOption[];
  optionsError: Error | null;
  onClearFilters: () => void;
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
        {loadError ? <p role="alert">{loadError.message}</p> : null}
        {members.data?.length === 0 ? (
          <EmptyState
            description="Invite someone to get started."
            icon={Users}
            title="No members yet"
          />
        ) : null}
        {members.data?.length && !visible.length ? (
          <EmptyState
            action={
              <Button onClick={onClearFilters} variant="outline">
                Clear filters
              </Button>
            }
            icon={Users}
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

function MembersTabs({
  estateId,
  permission,
}: {
  estateId: string;
  permission: components["schemas"]["EstateAccessResponse"];
}) {
  const [filter, setFilter] = useState<MemberFilter>(emptyFilter);
  const clear = useCallback(() => setFilter(emptyFilter), []);
  const members = useEstateMembers(estateId, true);
  const invitations = useOutstandingInvitations(estateId);
  const { options, error } = useRoleOptions(estateId);
  const roleFilters = [
    { value: OWNER_ROLE, label: "Owner" },
    ...options.map((option) => ({
      value: option.customRoleId ?? option.role,
      label: option.label,
    })),
  ];
  return (
    <div className="space-y-4">
      <MemberFilters filter={filter} onChange={setFilter} roles={roleFilters} />
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">
            Members{" "}
            {members.data ? (
              <Badge variant="secondary">{members.data.length}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="invitations">
            Pending invitations{" "}
            {invitations.data ? (
              <Badge variant="secondary">{invitations.data.length}</Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <EstateMembers
            estateId={estateId}
            filter={filter}
            onClearFilters={clear}
            options={options}
            optionsError={error}
            permission={permission}
          />
        </TabsContent>
        <TabsContent value="invitations">
          <OwnerInvitations
            estateId={estateId}
            filter={isFiltered(filter) ? filter : undefined}
            onClearFilters={clear}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function CouncilPage({ estateId }: { estateId: string }) {
  const access = useAppAccess();
  const { ready } = useAuthenticatedSession();
  const retry = useCallback(() => {
    access.refetch();
  }, [access]);
  const permission = access.data?.estates?.find(
    (estate) => estate.estateId === estateId
  );
  if (!ready || access.isPending) {
    return <LoadingState label="Loading estate access…" rows={2} />;
  }
  if (access.error) {
    return (
      <div>
        <p role="alert">{access.error.message}</p>
        <Button onClick={retry}>Retry access</Button>
      </div>
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
      <p role="alert">
        You do not have permission to invite members to this estate.
      </p>
    );
  }
  return (
    <PageLayout className="space-y-6">
      <PageHeader
        actions={
          permission.canInviteMembers ? (
            <InviteMemberDialog estateId={estateId} />
          ) : null
        }
        description={`People with access to ${permission.estateName}, and invitations waiting to be accepted.`}
        title={manager ? "Estate members" : "Estate invitations"}
      />
      {permission.canInviteMembers ? null : (
        <p className="text-muted-foreground text-sm">
          This estate is inactive. New invitations are disabled.
        </p>
      )}
      {manager ? (
        <MembersTabs estateId={estateId} permission={permission} />
      ) : (
        <OwnerInvitations estateId={estateId} />
      )}
    </PageLayout>
  );
}
