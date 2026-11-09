import type { components } from "@proj/api/schema";
import { Users } from "lucide-react";
import { useCallback, useState } from "react";
import { useFilterPanel } from "@/components/filters/filter-bar";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PEOPLE_TITLE, PeopleViews } from "@/components/people/people-views";
import {
  useEstateRoleDefinitions,
  useEstateRolePermissions,
} from "@/lib/estate-roles";
import { OwnerInvitations } from "@/routes/_auth/estates/$estateId/council/-components/council-page/access-controls";
import { EstateMembers } from "@/routes/_auth/estates/$estateId/council/-components/council-page/estate-members/estate-members";
import { InactiveNote } from "@/routes/_auth/estates/$estateId/council/-components/council-page/inactive-note";
import { InviteMemberDialog } from "@/routes/_auth/estates/$estateId/council/-components/council-page/invite-member-dialog/invite-member-dialog";
import {
  emptyFilter,
  filterCount,
  isFiltered,
  type MemberFilter,
  MemberFilters,
  OWNER_ROLE,
} from "@/routes/_auth/estates/$estateId/council/-components/council-page/member-filters";
import {
  presetOptions,
  type RoleOption,
} from "@/routes/_auth/estates/$estateId/council/-components/council-page/role-picker";

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

export function MembersWorkspace({
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
        title={PEOPLE_TITLE}
      />
      <PeopleViews estateId={estateId} permission={permission} />
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

export type CouncilView = "members" | "invitations";
