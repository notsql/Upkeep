import { Button } from "@proj/ui/components/button";
import { ListPlus } from "lucide-react";
import type { InspectionList } from "@/lib/inspection-list";

export function GenerateButton({
  data,
  pending,
  onGenerate,
}: {
  data: InspectionList;
  pending: boolean;
  onGenerate: () => void;
}) {
  return (
    <Button
      disabled={!data.estateActive || pending}
      onClick={onGenerate}
      type="button"
    >
      <ListPlus aria-hidden="true" />
      {data.generatedAt ? "Regenerate list" : "Generate list"}
    </Button>
  );
}
