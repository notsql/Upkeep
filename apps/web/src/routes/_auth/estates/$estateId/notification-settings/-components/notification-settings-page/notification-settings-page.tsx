import { Building2 } from "lucide-react";
import { FormPage } from "@/components/page/form-page";
import {
  EstateSettingsViews,
  SETTINGS_TITLE,
} from "@/components/settings/estate-settings-views";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useAppAccess } from "@/lib/access";
import { useEstate } from "@/lib/estates";
import { useNotificationSettings } from "@/lib/notifications";
import { NotificationSettingsForm } from "@/routes/_auth/estates/$estateId/notification-settings/-components/notification-settings-page/notification-settings-form";

/** An estate's notification switches (spec notification-switches-and-milestone-reminders.md), the Notifications tab of Estate settings. */
export function NotificationSettingsPage({ estateId }: { estateId: string }) {
  const settings = useNotificationSettings(estateId);
  const estate = useEstate(estateId);
  const access = useAppAccess();
  const inactive = Boolean(estate.data?.deactivatedAt);

  return (
    <FormPage
      breadcrumbs={[]}
      description="Which messages this estate's team gets"
      icon={Building2}
      title={SETTINGS_TITLE}
    >
      <EstateSettingsViews
        estateId={estateId}
        owned={estate.data?.owned}
        permission={access.data?.estates.find(
          (assignment) => assignment.estateId === estateId
        )}
      />
      <div className="max-w-xl">
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
    </FormPage>
  );
}
