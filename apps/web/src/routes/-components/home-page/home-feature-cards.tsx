import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Building2, Layers, Users } from "lucide-react";

export function HomeFeatureCards() {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <span
            aria-hidden="true"
            className="bg-brand-1/15 text-brand-3 mb-2 flex size-9 items-center justify-center rounded-lg"
          >
            <Building2 className="size-5" />
          </span>
          <CardTitle>Estates</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Locations and estate details
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <span
            aria-hidden="true"
            className="bg-brand-1/15 text-brand-3 mb-2 flex size-9 items-center justify-center rounded-lg"
          >
            <Layers className="size-5" />
          </span>
          <CardTitle>Assets</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Equipment, condition and lifecycle
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <span
            aria-hidden="true"
            className="bg-brand-1/15 text-brand-3 mb-2 flex size-9 items-center justify-center rounded-lg"
          >
            <Users className="size-5" />
          </span>
          <CardTitle>Council access</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Invitations and permissions
        </CardContent>
      </Card>
    </div>
  );
}
