import type { components } from "@proj/api/schema";
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { useCallback, useEffect, useState } from "react";
import { Pagination } from "@/components/pagination";
import { MemberPermission } from "./member-permission";
import type { RoleOption } from "./role-picker";

export function EstateMembersTable({
  estateId,
  members,
  canTransfer,
  canReassign,
  options,
}: {
  estateId: string;
  members: components["schemas"]["EstateMemberResponse"][];
  canTransfer: boolean;
  canReassign: boolean;
  options: RoleOption[];
}) {
  const [selectedPage, setSelectedPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(members.length / 20) - 1);
  const page = Math.min(selectedPage, lastPage);
  useEffect(
    () => setSelectedPage((current) => Math.min(current, lastPage)),
    [lastPage]
  );
  const previous = useCallback(
    () => setSelectedPage((current) => Math.max(0, current - 1)),
    []
  );
  const next = useCallback(
    () => setSelectedPage((current) => Math.min(lastPage, current + 1)),
    [lastPage]
  );
  const start = page * 20;
  return (
    <div className="min-w-0 space-y-4">
      <Table>
        <TableCaption className="sr-only">Estate members</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.slice(start, start + 20).map((member) => (
            <MemberPermission
              canReassign={canReassign}
              canTransfer={canTransfer}
              estateId={estateId}
              key={member.userId}
              member={member}
              options={options}
            />
          ))}
        </TableBody>
      </Table>
      <Pagination
        canNext={page < lastPage}
        canPrevious={page > 0}
        label="Member pages"
        onNext={next}
        onPrevious={previous}
        summary={`${members.length ? start + 1 : 0}–${Math.min(start + 20, members.length)} of ${members.length} members`}
      />
    </div>
  );
}
