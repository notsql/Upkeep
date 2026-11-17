import type { components } from "@proj/api/schema";
import * as fixtures from "@tests/fixtures/access";
import { describe, expect, it } from "vitest";
import {
  assetsEntry,
  canOpenAllReadings,
  canOpenAssets,
  canOpenContractors,
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
  role: "COUNCIL",
  canViewManagement: true,
};
const delegate = { ...managementOnly, canManageInvitationPermissions: true };

describe("owner-or-delegate destinations", () => {
  it.each([
    ["devices", canOpenDevices],
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

// Device monitoring follows the canViewDevices flag (VIEW_DEVICES; estate-role-permissions).
describe("sensors", () => {
  it("opens exactly when the user can view devices", () => {
    expect(canOpenSensors({ ...managementOnly, canViewDevices: true })).toBe(
      true
    );
    expect(canOpenSensors({ ...managementOnly, canViewDevices: false })).toBe(
      false
    );
    expect(canOpenSensors(crewEstateAccess)).toBe(false);
    expect(canOpenSensors(undefined)).toBe(false);
  });
});

describe("assets", () => {
  it("opens the read-only asset directory for history-only Council readers", () => {
    expect(
      canOpenAssets({ ...managementOnly, canViewAssetHistory: true })
    ).toBe(true);
  });
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
    expect(canOpenContractors(ownerEstateAccess)).toBe(true);
    expect(canOpenContractors(crewEstateAccess)).toBe(false);
    expect(canOpenContractors(undefined)).toBe(false);
  });
});

describe("assets entry", () => {
  it("lands asset readers on By location", () => {
    expect(assetsEntry(crewEstateAccess, false)).toBe(
      "/estates/$estateId/assets"
    );
    expect(assetsEntry({ ...managementOnly, canViewAssets: true }, false)).toBe(
      "/estates/$estateId/assets"
    );
  });
  it("lands device viewers without asset access on All devices", () => {
    expect(
      assetsEntry({ ...managementOnly, canViewDevices: true }, false)
    ).toBe("/estates/$estateId/assets/devices");
    expect(assetsEntry(managementOnly, true)).toBe(
      "/estates/$estateId/assets/devices"
    );
  });
  it("is absent for everyone else", () => {
    expect(assetsEntry(managementOnly, false)).toBeUndefined();
    expect(assetsEntry(residentEstateAccess, false)).toBeUndefined();
    expect(assetsEntry(undefined, false)).toBeUndefined();
  });
});

describe("all readings", () => {
  it("is linked for readings viewers other than Crew", () => {
    expect(canOpenAllReadings(ownerEstateAccess)).toBe(true);
    expect(
      canOpenAllReadings({
        ...managementOnly,
        role: "MANAGER",
        canViewReadings: true,
      })
    ).toBe(true);
    expect(canOpenAllReadings(crewEstateAccess)).toBe(false);
    expect(canOpenAllReadings(councilEstateAccess)).toBe(false);
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
