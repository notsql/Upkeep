import type { components } from "@proj/api/schema";
import { SubNav, type SubNavItem } from "@/components/page/sub-nav";
import { canOpenMembers, canOpenRoles } from "@/lib/estate-destinations";

/** The heading shared by the Members, Waiting to join and Roles views. */
export const PEOPLE_TITLE = "People & access";

/** Tabs across `/council`, `/council/invitations` and `/roles`, each shown only to those who can open it. */
export function PeopleViews({
  estateId,
  permission,
}: {
  estateId: string;
  permission: components["schemas"]["EstateAccessResponse"];
}) {
  const params = { estateId };
  const items: SubNavItem[] = [
    ...(canOpenMembers(permission)
      ? [
          {
            exact: true,
            label: "Members",
            params,
            to: "/estates/$estateId/council" as const,
          },
          {
            label: "Waiting to join",
            params,
            to: "/estates/$estateId/council/invitations" as const,
          },
        ]
      : []),
    ...(canOpenRoles(permission)
      ? [{ label: "Roles", params, to: "/estates/$estateId/roles" as const }]
      : []),
  ];
  return <SubNav items={items} label="People views" />;
}
