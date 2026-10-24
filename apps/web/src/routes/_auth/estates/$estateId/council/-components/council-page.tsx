import type { components } from "@proj/api/schema";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { useAppAccess, useAuthenticatedSession } from "@/lib/access";
import { useEstateMembers } from "@/lib/council-invitations";
import {
  useEstateRoleDefinitions,
  useEstateRolePermissions,
} from "@/lib/estate-roles";
import { useEstate } from "@/lib/estates";
import { OwnerInvitations } from "@/routes/_auth/estates/$estateId/council/-components/access-controls";
import { CouncilInvitationForm } from "@/routes/_auth/estates/$estateId/council/-components/invitation-form";
import { MemberPermission } from "@/routes/_auth/estates/$estateId/council/-components/member-permission";
import {
  presetOptions,
  type RoleOption,
} from "@/routes/_auth/estates/$estateId/council/-components/role-picker";

function EstateMembers({
  estateId,
  permission,
}: {
  estateId: string;
  permission: components["schemas"]["EstateAccessResponse"];
}) {
  const estate = useEstate(estateId);
  const members = useEstateMembers(estateId, true);
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
  const options = [...presetOptions, ...customOptions];
  const canReassign =
    (permission.canReassignRoles ?? true) && !estate.data?.deactivatedAt;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Estate roles</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Manage each member’s role in this estate.
        </p>
        {canReassign ? null : (
          <p>
            This estate is inactive. Reactivation is required before changing
            member roles.
          </p>
        )}
        {members.isPending ? <p>Loading members…</p> : null}
        {members.error || estate.error || roles.error || catalogue.error ? (
          <p role="alert">
            {members.error?.message ??
              estate.error?.message ??
              roles.error?.message ??
              catalogue.error?.message}
          </p>
        ) : null}
        {members.data?.length === 0 ? (
          <p className="mt-4">No members yet. Invite someone to get started.</p>
        ) : null}
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {members.data?.map((member) => (
            <MemberPermission
              canReassign={canReassign}
              canTransfer={estate.data?.owned === true}
              estateId={estateId}
              key={member.userId}
              member={member}
              options={options}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
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
    return <p role="status">Loading estate access…</p>;
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
    <main className="page-layout space-y-6">
      {permission.canViewManagement ? (
        <Link
          className="text-sm underline"
          params={{ estateId }}
          to="/estates/$estateId"
        >
          Back to estate
        </Link>
      ) : null}
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          { label: permission.estateName },
          { label: manager ? "Estate members" : "Estate invitations" },
        ]}
        description={`Invitations and estate access for ${permission.estateName}.`}
        title={manager ? "Estate members" : "Estate invitations"}
      />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {permission.canInviteMembers ? (
          <CouncilInvitationForm estateId={estateId} />
        ) : (
          <p>This estate is inactive. New invitations are disabled.</p>
        )}
        <OwnerInvitations estateId={estateId} />
      </div>
      {manager ? (
        <EstateMembers estateId={estateId} permission={permission} />
      ) : null}
    </main>
  );
}
