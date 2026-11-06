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
          <Building2 aria-hidden="true" className="text-primary mb-2 size-6" />
          <CardTitle>Estates</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Locations and estate details
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Layers aria-hidden="true" className="text-primary mb-2 size-6" />
          <CardTitle>Assets</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Equipment, condition and lifecycle
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Users aria-hidden="true" className="text-primary mb-2 size-6" />
          <CardTitle>Council access</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Invitations and permissions
        </CardContent>
      </Card>
    </div>
  );
}
