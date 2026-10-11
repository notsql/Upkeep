import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@proj/ui/components/table";
import { expect, it } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

it("gives a wide table a labelled keyboard-reachable scroll region", () => {
  renderWithProviders(
    <Table aria-label="Assets">
      <TableBody>
        <TableRow>
          <TableCell>Equipment</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
  expect(screen.getByRole("region", { name: "Assets table" }).tabIndex).toBe(0);
  screen.getByRole("table", { name: "Assets" });
});
