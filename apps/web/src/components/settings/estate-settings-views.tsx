import type { components } from "@proj/api/schema";
import { SubNav, type SubNavItem } from "@/components/page/sub-nav";
import {
  canOpenEstateSettings,
  canOpenNotificationSettings,
} from "@/lib/estate-destinations";

/** The heading shared by the Details and Notifications views. */
export const SETTINGS_TITLE = "Estate settings";

/** Tabs across `/edit` and `/notification-settings`, each shown only to those who can open it. */
export function EstateSettingsViews({
  estateId,
  owned,
  permission,
}: {
  estateId: string;
  owned?: boolean;
  permission?: components["schemas"]["EstateAccessResponse"];
}) {
  const params = { estateId };
  const items: SubNavItem[] = [
    ...(canOpenEstateSettings(permission, owned)
      ? [{ label: "Details", params, to: "/estates/$estateId/edit" as const }]
      : []),
    ...(canOpenNotificationSettings(permission)
      ? [
          {
            label: "Notifications",
            params,
            to: "/estates/$estateId/notification-settings" as const,
          },
        ]
      : []),
  ];
  if (items.length === 0) {
    return null;
  }
  return <SubNav items={items} label="Settings views" />;
}
