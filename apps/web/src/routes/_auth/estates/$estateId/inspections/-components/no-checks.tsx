import { EmptyState } from "@/components/empty-state";

export function NoChecks({ generated }: { generated: boolean }) {
  return (
    <EmptyState
      description={
        generated
          ? "Nothing due this month"
          : "Generate the list to see due checks"
      }
      title="No checks this month"
    />
  );
}
