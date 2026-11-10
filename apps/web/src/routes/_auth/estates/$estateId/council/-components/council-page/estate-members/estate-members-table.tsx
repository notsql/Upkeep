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
import { ListRows } from "@/components/list/list-row";
import { LoadMore } from "@/components/table/load-more";
import { Pagination } from "@/components/table/pagination";
import { useMobile } from "@/lib/use-mobile";
import { MemberPermission } from "@/routes/_auth/estates/$estateId/council/-components/council-page/estate-members/member-permission";
import type { RoleOption } from "@/routes/_auth/estates/$estateId/council/-components/council-page/role-picker";

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
  const mobile = useMobile();
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
  // Phones grow one list instead of paging: show every page up to this one.
  const shown = members.slice(mobile ? 0 : start, start + 20);
  return (
    <div className="min-w-0 space-y-4">
      {mobile ? (
        <ListRows label="Estate members">
          {shown.map((member) => (
            <MemberPermission
              canReassign={canReassign}
              canTransfer={canTransfer}
              estateId={estateId}
              key={member.userId}
              member={member}
              mobile
              options={options}
            />
          ))}
        </ListRows>
      ) : (
        <div className="max-w-full min-w-0 overflow-x-auto rounded-xl border">
          <Table>
            <TableCaption className="sr-only">Estate members</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((member) => (
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
        </div>
      )}
      {mobile && lastPage > 0 ? (
        <LoadMore
          fetchNextPage={next}
          hasNextPage={page < lastPage}
          isFetchingNextPage={false}
          key={page}
        />
      ) : null}
      {!mobile && lastPage > 0 ? (
        <Pagination
          canNext={page < lastPage}
          canPrevious={page > 0}
          label="Member pages"
          onNext={next}
          onPrevious={previous}
          summary={`${members.length ? start + 1 : 0}–${Math.min(start + 20, members.length)} of ${members.length} members`}
        />
      ) : null}
    </div>
  );
}
