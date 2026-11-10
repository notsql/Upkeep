import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { HeartPulse } from "lucide-react";
import { PageSection } from "@/components/page/section-card";
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
    <div className="mt-8">
      <PageSection icon={HeartPulse} title="System status">
        {content}
      </PageSection>
    </div>
  );
}
