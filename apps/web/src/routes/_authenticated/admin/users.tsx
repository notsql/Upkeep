import { Input } from "@proj/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api";
import { MemberEstates } from "@/routes/_authenticated/admin/-components/member-estates";

const ADMIN_ROLE = "admin";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
  loader: async () => {
    const auth = await getAuth();

    if (!auth.user || auth.role !== ADMIN_ROLE) {
      throw redirect({ to: "/estates" });
    }
  },
});

const selectClassName =
  "h-9 rounded-md border border-input bg-background px-3 text-sm " +
  "text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const memberQueryKey = (organizationId: string) =>
  ["admin", "members", organizationId] as const;

// Local mutation arguments; API request/response types remain inferred.
interface RoleChange {
  membershipId: string;
  organizationId: string;
  role: string;
}

interface SelectedMember {
  name: string;
  userId: string;
}

function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [organizationId, setOrganizationId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<SelectedMember>();

  const organizations = useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET(
        "/api/admin/users/organization/all",
        { signal }
      );

      if (error || !data) {
        throw new Error("Unable to load organizations");
      }

      return data;
    },
  });

  const members = useQuery({
    queryKey: memberQueryKey(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET(
        "/api/admin/users/organization/{organizationId}/members",
        {
          params: { path: { organizationId } },
          signal,
        }
      );

      if (error || !data) {
        throw new Error("Unable to load members");
      }

      return data;
    },
  });

  const organizationRoles = useQuery({
    queryKey: ["admin", "roles", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET(
        "/api/admin/users/organization/{organizationId}/roles",
        {
          params: { path: { organizationId } },
          signal,
        }
      );

      if (error || !data) {
        throw new Error("Unable to load roles");
      }

      return data;
    },
  });

  const roleUpdate = useMutation({
    mutationFn: async ({ membershipId, role }: RoleChange) => {
      const { error } = await api.PUT("/api/admin/users/{membershipId}/role", {
        params: { path: { membershipId } },
        body: { roleSlugs: [role] },
      });

      if (error) {
        throw new Error("Unable to update role");
      }
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({
        queryKey: memberQueryKey(variables.organizationId),
        exact: true,
      }),
  });

  const handleOrganizationChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setOrganizationId(event.target.value);
      setSelectedMember(undefined);
      roleUpdate.reset();
    },
    [roleUpdate]
  );

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearch(event.target.value);
    },
    []
  );

  const handleRoleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const {
        dataset: { currentRole = "", membershipId },
        value: role,
      } = event.target;

      if (!membershipId || role === currentRole) {
        return;
      }

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

  const error =
    organizations.error ??
    members.error ??
    organizationRoles.error ??
    roleUpdate.error;

  const isLoadingOrganization =
    Boolean(organizationId) &&
    (members.isPending || organizationRoles.isPending);

  const rolesUnavailable =
    !organizationRoles.isSuccess || organizationRoles.data.length === 0;

  return (
    <main className="min-h-full bg-background px-6 py-10 text-foreground sm:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 font-semibold text-primary text-sm uppercase tracking-widest">
              Administration
            </p>
            <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">
              User roles
            </h1>
            <p className="mt-2 text-muted-foreground">
              Manage what each member can access. Changes are saved
              automatically.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card px-4 py-3 text-card-foreground shadow-sm">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Total users
            </p>
            <p className="mt-1 font-semibold text-2xl">
              {members.data?.length ?? "—"}
            </p>
          </div>
        </header>

        {error ? (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
            role="alert"
          >
            {error.message}
          </p>
        ) : null}

        {organizations.isPending ? <p role="status">Loading estates…</p> : null}

        {organizations.data?.length === 0 && (
          <p className="text-muted-foreground">No estates found.</p>
        )}

        {Boolean(organizations.data?.length) && (
          <label className="flex flex-wrap items-center gap-3 font-medium text-sm">
            Estate
            <select
              className={selectClassName}
              disabled={roleUpdate.isPending}
              onChange={handleOrganizationChange}
              value={organizationId}
            >
              <option value="">Select an estate</option>
              {organizations.data?.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {isLoadingOrganization ? (
          <p role="status">Loading members and roles…</p>
        ) : null}

        {roleUpdate.isPending ? (
          <p className="text-muted-foreground text-sm" role="status">
            Saving role and refreshing members…
          </p>
        ) : null}

        <section
          aria-labelledby="members-heading"
          className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
        >
          <div className="flex flex-col gap-4 border-border border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold" id="members-heading">
                Members
              </h2>
              <p className="mt-1 text-muted-foreground text-sm">
                Choose a role for each member.
              </p>
            </div>

            <label className="block sm:w-72" htmlFor="user-search">
              <span className="sr-only">Search users</span>
              <Input
                className="h-9 rounded-md"
                id="user-search"
                onChange={handleSearchChange}
                placeholder="Search by name or email"
                type="search"
                value={search}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Users and assigned roles</caption>
              <thead className="bg-muted text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-medium" scope="col">
                    User
                  </th>
                  <th className="px-5 py-3 font-medium" scope="col">
                    Joined
                  </th>
                  <th className="px-5 py-3 font-medium" scope="col">
                    Current role
                  </th>
                  <th className="px-5 py-3 font-medium" scope="col">
                    Estates
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => {
                  const currentRole = user.roleSlugs?.[0] ?? "";
                  const hasMultipleRoles = (user.roleSlugs?.length ?? 0) > 1;
                  const name = user.name || user.email || "Unnamed member";
                  const currentRoleMissing =
                    Boolean(currentRole) &&
                    !organizationRoles.data?.some(
                      (role) => role.slug === currentRole
                    );

                  return (
                    <tr
                      className="align-middle hover:bg-muted/50"
                      key={user.membershipId ?? user.userId ?? user.email}
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium">{name}</p>
                        <p className="mt-1 text-muted-foreground">
                          {user.email}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {user.joined ? user.joined.toLocaleString() : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <label>
                          <span className="sr-only">Role for {name}</span>
                          <select
                            className={selectClassName}
                            data-current-role={currentRole}
                            data-membership-id={user.membershipId}
                            disabled={
                              roleUpdate.isPending ||
                              rolesUnavailable ||
                              hasMultipleRoles ||
                              !user.membershipId
                            }
                            onChange={handleRoleChange}
                            value={currentRole}
                          >
                            <option disabled value="">
                              Select a role
                            </option>
                            {currentRoleMissing ? (
                              <option disabled value={currentRole}>
                                {currentRole}
                              </option>
                            ) : null}
                            {organizationRoles.data?.map((role) => (
                              <option key={role.slug} value={role.slug}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        {hasMultipleRoles && (
                          <p className="mt-1 text-muted-foreground text-xs">
                            Manage multiple roles in WorkOS.
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          aria-label={`Manage estates for ${name}`}
                          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                          data-member-name={name}
                          data-user-id={user.userId}
                          disabled={!user.userId}
                          onClick={handleManageEstates}
                          type="button"
                        >
                          Manage estates
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!organizationId && (
            <p className="px-5 py-12 text-center text-muted-foreground text-sm">
              Select an estate to view its members.
            </p>
          )}

          {members.isSuccess && filteredUsers.length === 0 && (
            <p className="px-5 py-12 text-center text-muted-foreground text-sm">
              No members found for this estate or search.
            </p>
          )}
        </section>

        {selectedMember ? (
          <MemberEstates
            key={selectedMember.userId}
            name={selectedMember.name}
            userId={selectedMember.userId}
          />
        ) : null}

        <p className="text-muted-foreground text-xs">
          Role changes are saved automatically. Members with multiple roles must
          be managed in WorkOS.
        </p>
      </div>
    </main>
  );
}
