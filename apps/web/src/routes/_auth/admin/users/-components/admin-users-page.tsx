import { Button } from "@proj/ui/components/button";
import { Card } from "@proj/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Users } from "lucide-react";
import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { FilterBar, useFilterPanel } from "@/components/filter-bar";
import { ListPageHeader } from "@/components/list-page-header";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
import { SectionHeading } from "@/components/section-heading";
import { api } from "@/lib/api";
import { useMobile } from "@/lib/use-mobile";
import { MemberEstates } from "@/routes/_auth/admin/-components/member-estates";
import { ManageEstateButton } from "@/routes/_auth/admin/users/-components/manage-estate-button";
import { RoleEditor } from "@/routes/_auth/admin/users/-components/role-editor";

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

const ROLE_UPDATE_REASONS = new Set([
  "Estate must have at least 1 admin.",
  "You cannot remove your own admin role.",
]);

function roleUpdateError(error: unknown, status: number | undefined): Error {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : undefined;
  if (status === 409 && message && ROLE_UPDATE_REASONS.has(message)) {
    return new Error(`Unable to update role: ${message}`);
  }
  return new Error("Unable to update role");
}

export function AdminUsersPage() {
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
      const { error, response } = await api.PUT(
        "/api/admin/users/{membershipId}/role",
        {
          params: { path: { membershipId } },
          body: { roleSlugs: [role] },
        }
      );

      if (error) {
        throw roleUpdateError(error, response?.status);
      }
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({
        queryKey: memberQueryKey(variables.organizationId),
        exact: true,
      }),
  });

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

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <ListPageHeader
          actions={
            <Card className="gap-1 px-4" size="sm">
              <p className="text-muted-foreground text-xs">Total users</p>
              <p className="text-2xl font-semibold">
                {members.data?.length ?? "—"}
              </p>
            </Card>
          }
          description="Member roles and estate access"
          filters={
            organizations.data?.length
              ? { activeCount, ...panel.toggleProps }
              : undefined
          }
          icon={ShieldCheck}
          title="User roles"
        />

        {loadError ? (
          <ErrorState message={loadError.message} onRetry={retryLoad} />
        ) : null}

        {roleUpdate.error ? (
          <p className="text-destructive text-sm" role="alert">
            {roleUpdate.error.message}
          </p>
        ) : null}

        {organizations.isPending ? (
          <LoadingState label="Loading estates…" rows={2} />
        ) : null}

        {organizations.data?.length === 0 && (
          <EmptyState
            description="Created estates appear here"
            title="No estates yet"
          />
        )}

        {Boolean(organizations.data?.length) && (
          <FilterBar
            {...panel.barProps}
            activeCount={activeCount}
            label="Filter users"
            onClear={clearSearch}
            search={
              <Field>
                <FieldLabel className="sr-only" htmlFor="user-search">
                  Search users
                </FieldLabel>
                <Input
                  id="user-search"
                  onChange={handleSearchChange}
                  placeholder="Search by name or email"
                  type="search"
                  value={search}
                />
              </Field>
            }
          >
            <Field className="w-full sm:w-48">
              <FieldLabel htmlFor="admin-estate">Estate</FieldLabel>
              <Select
                disabled={roleUpdate.isPending}
                items={organizationItems}
                onValueChange={handleOrganizationChange}
                value={organizationId}
              >
                <SelectTrigger className="w-full" id="admin-estate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Select an estate</SelectItem>
                  {organizations.data?.map((organization) => (
                    <SelectItem key={organization.id} value={organization.id}>
                      {organization.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FilterBar>
        )}

        {isLoadingOrganization ? (
          <LoadingState label="Loading members and roles…" variant="table" />
        ) : null}

        {roleUpdate.isPending ? (
          <p className="text-muted-foreground text-sm" role="status">
            Saving role and refreshing members…
          </p>
        ) : null}

        <section
          aria-labelledby="members-heading"
          className="border-border bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm"
        >
          <div className="border-border flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SectionHeading icon={Users} id="members-heading">
                Members
              </SectionHeading>
              <p className="text-muted-foreground mt-1 text-sm">
                Role per member
              </p>
            </div>
          </div>

          {mobile ? (
            <ul aria-label="Members" className="grid gap-3 p-4">
              {filteredUsers.map((user) => {
                const name = user.name || user.email || "Unnamed member";
                return (
                  <li key={user.membershipId ?? user.userId ?? user.email}>
                    <Card className="gap-3 p-4">
                      <div>
                        <h3 className="font-semibold break-words">{name}</h3>
                        <p className="text-muted-foreground text-sm break-all">
                          {user.email}
                        </p>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        Joined{" "}
                        {user.joined
                          ? new Date(user.joined).toLocaleDateString()
                          : "—"}
                      </p>
                      <RoleEditor
                        name={name}
                        onRoleChange={handleRoleChange}
                        pending={roleUpdate.isPending}
                        roles={organizationRoles.data ?? []}
                        rolesUnavailable={rolesUnavailable}
                        user={user}
                      />
                      <ManageEstateButton
                        name={name}
                        onManage={handleManageEstates}
                        user={user}
                      />
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Table aria-label="Admin users" className="min-w-[640px] text-sm">
              <TableCaption className="sr-only">
                Users and assigned roles
              </TableCaption>
              <TableHeader className="bg-muted text-xs tracking-wide uppercase">
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="text-muted-foreground px-5 py-3"
                    scope="col"
                  >
                    User
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground px-5 py-3"
                    scope="col"
                  >
                    Joined
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground px-5 py-3"
                    scope="col"
                  >
                    Current role
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground px-5 py-3"
                    scope="col"
                  >
                    Estates
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredUsers.map((user) => {
                  const name = user.name || user.email || "Unnamed member";

                  return (
                    <TableRow
                      key={user.membershipId ?? user.userId ?? user.email}
                    >
                      <TableCell className="px-5 py-4">
                        <p className="font-medium">{name}</p>
                        <p className="text-muted-foreground mt-1">
                          {user.email}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-5 py-4">
                        {user.joined
                          ? new Date(user.joined).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <RoleEditor
                          name={name}
                          onRoleChange={handleRoleChange}
                          pending={roleUpdate.isPending}
                          roles={organizationRoles.data ?? []}
                          rolesUnavailable={rolesUnavailable}
                          user={user}
                        />
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <ManageEstateButton
                          name={name}
                          onManage={handleManageEstates}
                          user={user}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!organizationId && (
            <div className="p-4">
              <EmptyState
                description="Pick an estate to see members"
                title="No estate selected"
              />
            </div>
          )}

          {members.isSuccess && filteredUsers.length === 0 && (
            <div className="p-4">
              {search.trim() ? (
                <EmptyState
                  action={
                    <Button onClick={clearSearch} variant="outline">
                      Clear filters
                    </Button>
                  }
                  description="Try another name or email"
                  title="No matching users"
                />
              ) : (
                <EmptyState title="No members yet" />
              )}
            </div>
          )}
        </section>

        <Dialog onOpenChange={closeAccess} open={Boolean(selectedMember)}>
          {selectedMember ? (
            <DialogContent
              className="sm:max-w-xl"
              finalFocus={returnFocus}
              showCloseButton={!accessPending}
            >
              <DialogHeader>
                <DialogTitle>
                  Estate access for {selectedMember.name}
                </DialogTitle>
                <DialogDescription>
                  Changes save automatically. Estate owners retain their access.
                </DialogDescription>
              </DialogHeader>
              <MemberEstates
                key={selectedMember.userId}
                name={selectedMember.name}
                onPendingChange={setAccessPending}
                showTitle={false}
                userId={selectedMember.userId}
              />
            </DialogContent>
          ) : null}
        </Dialog>

        <p className="text-muted-foreground text-xs">
          Role changes are saved automatically. Members with multiple roles must
          be managed in WorkOS.
        </p>
      </div>
    </PageLayout>
  );
}
