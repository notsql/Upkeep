import { BellRing } from "lucide-react";
import { PageHeader } from "@/components/page/page-header";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useEstate } from "@/lib/estates";
import { useNotificationSettings } from "@/lib/notifications";
import { NotificationSettingsForm } from "@/routes/_auth/estates/$estateId/notification-settings/-components/notification-settings-page/notification-settings-form";

/** An estate's notification thresholds (spec notifications.md, "Notification settings"). */
export function NotificationSettingsPage({ estateId }: { estateId: string }) {
  const settings = useNotificationSettings(estateId);
  const estate = useEstate(estateId);
  const inactive = Boolean(estate.data?.deactivatedAt);

  return (
    <PageLayout>
      <PageHeader
        breadcrumbs={[{ label: estate.data?.name ?? "Estate" }]}
        description="When managers of this estate are notified about anomalies, services and predicted repairs"
        icon={BellRing}
        title="Notification settings"
      />
      <div className="mt-6 max-w-xl">
        {settings.error ? (
          <ErrorState
            message={settings.error.message}
            onRetry={settings.refetch}
          />
        ) : null}
        {!settings.error && settings.data ? (
          <NotificationSettingsForm
            estateId={estateId}
            inactive={inactive}
            settings={settings.data}
          />
        ) : null}
        {settings.error || settings.data ? null : (
          <LoadingState label="Loading notification settings" variant="list" />
        )}
      </div>
    </PageLayout>
  );
}
