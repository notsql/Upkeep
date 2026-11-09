import { Alert, AlertDescription } from "@proj/ui/components/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { HeartPulse } from "lucide-react";
import { useHealth } from "@/lib/health";

export function SystemStatus() {
  const health = useHealth();
  let content = <p role="status">Checking availability…</p>;
  if (health.error) {
    content = (
      <Alert variant="destructive">
        <AlertDescription>System status is unavailable.</AlertDescription>
      </Alert>
    );
  } else if (!health.isPending) {
    content = (
      <p className="text-muted-foreground text-sm">
        Service: {health.data?.ok ? "Available" : "Unavailable"} · Data
        connection: {health.data?.database ? "Available" : "Unavailable"}
      </p>
    );
  }
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse aria-hidden="true" className="text-brand-2 size-4" />
          System status
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
