import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFilterPanel } from "@/components/filter-bar";
import {
  useAdminMembers,
  useAdminOrganizationRoles,
  useAdminOrganizations,
  useAdminRoleUpdate,
} from "@/lib/admin-users";
import { useMobile } from "@/lib/use-mobile";

export interface SelectedMember {
  name: string;
  userId: string;
}

export function useAdminUsersPage() {
  const mobile = useMobile();
  const returnFocus = useRef<HTMLButtonElement>(null);
  const [accessPending, setAccessPending] = useState(false);
  const closeAccess = useCallback(
    (open: boolean) => {
      if (!(open || accessPending)) {
        setSelectedMember(undefined);
      }
    },
    [accessPending]
  );
  const [organizationId, setOrganizationId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<SelectedMember>();

  const organizations = useAdminOrganizations();
  const members = useAdminMembers(organizationId);
  const organizationRoles = useAdminOrganizationRoles(organizationId);
  const roleUpdate = useAdminRoleUpdate();

  const handleOrganizationChange = useCallback(
    (value: string | null) => {
      setOrganizationId(value ?? "");
      setSelectedMember(undefined);
      roleUpdate.reset();
    },
    [roleUpdate]
  );

  const clearSearch = useCallback(() => setSearch(""), []);
  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearch(event.target.value);
    },
    []
  );

  const handleRoleChange = useCallback(
    (membershipId: string, role: string) => {
      roleUpdate.mutate({
        organizationId,
        membershipId,
        role,
      });
    },
    [organizationId, roleUpdate]
  );

  const handleManageEstates = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      returnFocus.current = event.currentTarget;
      const { memberName = "", userId } = event.currentTarget.dataset;
      if (userId) {
        setSelectedMember({ name: memberName, userId });
      }
    },
    []
  );

  const filteredUsers = useMemo(() => {
    const users = members.data ?? [];
    const query = search.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter(
      (user) =>
        (user.name ?? "").toLowerCase().includes(query) ||
        (user.email ?? "").toLowerCase().includes(query)
    );
  }, [members.data, search]);

  const organizationItems = [
    { value: "", label: "Select an estate" },
    ...(organizations.data ?? []).map((organization) => ({
      value: organization.id,
      label: organization.name,
    })),
  ];

  const loadError =
    organizations.error ?? members.error ?? organizationRoles.error;
  const retryLoad = useCallback(() => {
    if (organizations.error) {
      organizations.refetch();
    }
    if (members.error) {
      members.refetch();
    }
    if (organizationRoles.error) {
      organizationRoles.refetch();
    }
  }, [organizations, members, organizationRoles]);
  const activeCount = search.trim() ? 1 : 0;
  // Starts open: the estate picker that scopes the page lives in the panel.
  const panel = useFilterPanel(1);

  const isLoadingOrganization =
    Boolean(organizationId) &&
    (members.isPending || organizationRoles.isPending);

  const rolesUnavailable =
    !organizationRoles.isSuccess || organizationRoles.data.length === 0;

  return {
    accessPending,
    activeCount,
    clearSearch,
    closeAccess,
    filteredUsers,
    handleManageEstates,
    handleOrganizationChange,
    handleRoleChange,
    handleSearchChange,
    isLoadingOrganization,
    loadError,
    members,
    mobile,
    organizationId,
    organizationItems,
    organizationRoles,
    organizations,
    panel,
    retryLoad,
    returnFocus,
    roleUpdate,
    rolesUnavailable,
    search,
    selectedMember,
    setAccessPending,
  };
}
