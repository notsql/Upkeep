import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";

export function ManualReadingFormFooter({
  assetId,
  estateId,
  pending,
  saved,
}: {
  assetId: string | undefined;
  estateId: string;
  pending: boolean;
  saved: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button disabled={pending || saved} type="submit">
        {pending ? "Saving reading…" : "Save manual reading"}
      </Button>
      <Button
        disabled={pending}
        render={
          <Link
            params={{ estateId }}
            search={{ assetId }}
            to="/estates/$estateId/readings"
          />
        }
        variant="outline"
      >
        Cancel
      </Button>
    </div>
  );
}
