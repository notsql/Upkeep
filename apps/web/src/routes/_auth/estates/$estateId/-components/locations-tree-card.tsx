import { Card, CardContent } from "@proj/ui/components/card";
import { Building } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { SectionHeading } from "@/components/section-heading";
import { LocationTree } from "@/routes/_auth/estates/$estateId/-components/location-tree";

export function LocationsTreeCard({
  id,
  pending,
  error,
  onRetry,
  tree,
  dialog,
}: {
  id: string;
  pending: boolean;
  error: Error | null;
  onRetry: () => void;
  /** The tree's props, or undefined until locations have loaded. */
  tree: ComponentProps<typeof LocationTree> | undefined;
  dialog: ReactNode;
}) {
  return (
    <Card className="mt-4">
      <CardContent>
        <section
          aria-labelledby={`${id}-heading`}
          className="scroll-mt-24"
          id="locations"
        >
          <SectionHeading icon={Building} id={`${id}-heading`}>
            Blocks and levels
          </SectionHeading>
          {pending ? (
            <div className="mt-4">
              <LoadingState label="Loading locations…" />
            </div>
          ) : null}
          {error ? (
            <div className="mt-4">
              <ErrorState message={error.message} onRetry={onRetry} />
            </div>
          ) : null}
          {tree ? <LocationTree {...tree} /> : null}
          {dialog}
        </section>
      </CardContent>
    </Card>
  );
}
