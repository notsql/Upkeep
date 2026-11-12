import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import type { Contractor } from "@/lib/contractors";
import { equipmentLabel } from "@/lib/report-routing";
import { ContractorDialog } from "@/routes/_auth/estates/$estateId/contractors/-components/contractor-dialog";
import { RemoveContractorDialog } from "@/routes/_auth/estates/$estateId/contractors/-components/remove-contractor-dialog";

export function ContractorTable({
  estateId,
  contractors,
}: {
  estateId: string;
  contractors: Contractor[];
}) {
  if (contractors.length === 0) {
    return (
      <p className="text-muted-foreground">
        No contractors yet. Add the firms you send jobs to.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table aria-label="Contractors">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Default for</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contractors.map((contractor) => (
            <TableRow key={contractor.id}>
              <TableCell className="font-medium">{contractor.name}</TableCell>
              <TableCell className="wrap-anywhere">
                {contractor.email}
              </TableCell>
              <TableCell>
                {contractor.defaultFor.length > 0
                  ? `Default for: ${contractor.defaultFor
                      .map((type) => equipmentLabel(type))
                      .join(", ")}`
                  : null}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <ContractorDialog
                    contractor={contractor}
                    estateId={estateId}
                    key={`${contractor.name}:${contractor.email}`}
                  />
                  <RemoveContractorDialog
                    contractor={contractor}
                    estateId={estateId}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
