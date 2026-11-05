import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import type { ChangeEvent } from "react";
import { FilterBar } from "@/components/filter-bar";
import type { Organization } from "@/routes/_auth/admin/users/-components/admin-user-types";

export function AdminUsersFilters({
  barProps,
  activeCount,
  onClear,
  search,
  onSearchChange,
  organizationId,
  organizationItems,
  organizations,
  onOrganizationChange,
  disabled,
}: {
  barProps: { id: string; open: boolean };
  activeCount: number;
  onClear: () => void;
  search: string;
  onSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  organizationId: string;
  organizationItems: { value: string | undefined; label: string | undefined }[];
  organizations: Organization[] | undefined;
  onOrganizationChange: (value: string | null) => void;
  disabled: boolean;
}) {
  return (
    <FilterBar
      {...barProps}
      activeCount={activeCount}
      label="Filter users"
      onClear={onClear}
      search={
        <Field>
          <FieldLabel className="sr-only" htmlFor="user-search">
            Search users
          </FieldLabel>
          <Input
            id="user-search"
            onChange={onSearchChange}
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
          disabled={disabled}
          items={organizationItems}
          onValueChange={onOrganizationChange}
          value={organizationId}
        >
          <SelectTrigger className="w-full" id="admin-estate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Select an estate</SelectItem>
            {organizations?.map((organization) => (
              <SelectItem key={organization.id} value={organization.id}>
                {organization.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FilterBar>
  );
}
