import { Button } from "@proj/ui/components/button";
import { SearchX, Users } from "lucide-react";
import { SectionHeading } from "@/components/page/section-heading";
import { EmptyState } from "@/components/states/empty-state";
import type { AdminUsersListProps } from "@/routes/_auth/admin/users/-components/admin-users-page/admin-users-members/admin-users-list-props";
import { AdminUsersMemberCards } from "@/routes/_auth/admin/users/-components/admin-users-page/admin-users-members/admin-users-member-cards";
import { AdminUsersTable } from "@/routes/_auth/admin/users/-components/admin-users-page/admin-users-members/admin-users-table";

export function AdminUsersMembers({
  mobile,
  list,
  organizationSelected,
  membersLoaded,
  searching,
  onClearSearch,
}: {
  mobile: boolean;
  list: AdminUsersListProps;
  organizationSelected: boolean;
  membersLoaded: boolean;
  searching: boolean;
  onClearSearch: () => void;
}) {
  return (
    <section
      aria-labelledby="members-heading"
      className="border-border bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm"
    >
      <div className="border-border flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <SectionHeading icon={Users} id="members-heading">
            Members
          </SectionHeading>
          <p className="text-muted-foreground mt-1 text-sm">Role per member</p>
        </div>
      </div>

      {mobile ? (
        <AdminUsersMemberCards {...list} />
      ) : (
        <AdminUsersTable {...list} />
      )}

      {!organizationSelected && (
        <div className="p-4">
          <EmptyState
            description="Pick an estate to see members"
            icon={Users}
            title="No estate selected"
          />
        </div>
      )}

      {membersLoaded && list.users.length === 0 && (
        <div className="p-4">
          {searching ? (
            <EmptyState
              action={
                <Button onClick={onClearSearch} variant="outline">
                  Clear filters
                </Button>
              }
              description="Try another name or email"
              icon={SearchX}
              title="No matching users"
            />
          ) : (
            <EmptyState icon={Users} title="No members yet" />
          )}
        </div>
      )}
    </section>
  );
}
