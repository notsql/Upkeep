import type { components } from "@proj/api/schema";
import * as fixtures from "@tests/fixtures/access";
import { describe, expect, it } from "vitest";
import {
  canOpenAssetCategories,
  canOpenAssets,
  canOpenDevices,
  canOpenDocuments,
  canOpenEstateSettings,
  canOpenFailureRisk,
  canOpenFaultReports,
  canOpenInspections,
  canOpenMembers,
  canOpenNotificationSettings,
  canOpenOverview,
  canOpenReadings,
  canOpenRoles,
  canOpenSensors,
  canOpenWorkOrders,
} from "@/lib/estate-destinations";

type Permission = components["schemas"]["EstateAccessResponse"];
const councilEstateAccess = fixtures.councilEstateAccess as Permission;
const crewEstateAccess = fixtures.crewEstateAccess as Permission;
const ownerEstateAccess = fixtures.ownerEstateAccess as Permission;
const residentEstateAccess = fixtures.residentEstateAccess as Permission;
const managementOnly: Permission = {
  ...residentEstateAccess,
  role: "MEMBER",
  canViewManagement: true,
};
const delegate = { ...managementOnly, canManageInvitationPermissions: true };

describe("owner-or-delegate destinations", () => {
  it.each([
    ["devices", canOpenDevices],
    ["asset categories", canOpenAssetCategories],
    ["inspections", canOpenInspections],
  ])("%s need ownership or invitation-permission management", (_, open) => {
    expect(open(managementOnly, false)).toBe(false);
    expect(open(managementOnly, undefined)).toBe(false);
    expect(open(managementOnly, true)).toBe(true);
    expect(open(delegate, false)).toBe(true);
    expect(open(undefined, false)).toBe(false);
  });
});

describe("failure risk", () => {
  it("is owner only", () => {
    expect(canOpenFailureRisk(ownerEstateAccess, false)).toBe(false);
    expect(canOpenFailureRisk(managementOnly, true)).toBe(true);
  });
});

describe("estate settings", () => {
  it("needs ownership or estate management", () => {
    expect(canOpenEstateSettings(managementOnly, false)).toBe(false);
    expect(canOpenEstateSettings(managementOnly, true)).toBe(true);
    expect(
      canOpenEstateSettings({ ...managementOnly, canManageEstate: true }, false)
    ).toBe(true);
  });
});

describe("sensors", () => {
  it.each<[Permission["role"], boolean, boolean]>([
    ["MANAGER", false, true],
    ["COUNCIL", false, true],
    ["MEMBER", false, false],
    ["MEMBER", true, true],
    ["CREW", true, false],
  ])("%s with platform admin %s -> %s", (role, admin, expected) => {
    expect(canOpenSensors({ ...managementOnly, role }, false, admin)).toBe(
      expected
    );
  });
  it("opens for owners and requires management otherwise", () => {
    expect(canOpenSensors(crewEstateAccess, true)).toBe(true);
    expect(
      canOpenSensors(
        { ...managementOnly, role: "MANAGER", canViewManagement: false },
        false
      )
    ).toBe(false);
  });
});

describe("assets", () => {
  it("opens for asset readers and inspection-only users", () => {
    expect(canOpenAssets(managementOnly)).toBe(false);
    expect(canOpenAssets({ ...managementOnly, canViewAssets: true })).toBe(
      true
    );
    expect(canOpenAssets(crewEstateAccess)).toBe(true);
  });
});

describe("capability destinations", () => {
  it("follow their access flags", () => {
    expect(canOpenOverview(councilEstateAccess)).toBe(true);
    expect(canOpenOverview(residentEstateAccess)).toBe(false);
    expect(canOpenWorkOrders(crewEstateAccess)).toBe(true);
    expect(canOpenFaultReports(crewEstateAccess)).toBe(true);
    expect(canOpenReadings(crewEstateAccess)).toBe(true);
    expect(canOpenDocuments(crewEstateAccess)).toBe(false);
    expect(canOpenMembers(councilEstateAccess)).toBe(true);
    expect(canOpenMembers(crewEstateAccess)).toBe(false);
    expect(canOpenRoles(ownerEstateAccess)).toBe(true);
    expect(canOpenRoles(crewEstateAccess)).toBe(false);
  });
});

describe("notification settings", () => {
  it("is for estate managers, owners included", () => {
    expect(canOpenNotificationSettings(ownerEstateAccess)).toBe(true);
    expect(canOpenNotificationSettings(delegate)).toBe(false);
    expect(canOpenNotificationSettings(councilEstateAccess)).toBe(false);
    expect(canOpenNotificationSettings(crewEstateAccess)).toBe(false);
    expect(canOpenNotificationSettings(residentEstateAccess)).toBe(false);
    expect(canOpenNotificationSettings(undefined)).toBe(false);
  });
});
