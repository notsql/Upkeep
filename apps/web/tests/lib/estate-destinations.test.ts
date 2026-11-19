import type { components } from "@proj/api/schema";
import * as fixtures from "@tests/fixtures/access";
import { describe, expect, it } from "vitest";
import {
  assetsEntry,
  canOpenAllDevices,
  canOpenAllReadings,
  canOpenAssets,
  canOpenCheckSchedules,
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

// Every destination follows the access flags; ownership no longer opens anything
// (estate-role-permissions).
describe("flag-gated destinations", () => {
  it.each([
    ["inspections", canOpenInspections, "canViewInspectionResults"],
    ["check schedules", canOpenCheckSchedules, "canManageInspections"],
    ["devices", canOpenDevices, "canViewDevices"],
    ["all devices", canOpenAllDevices, "canViewDevices"],
    ["failure risk", canOpenFailureRisk, "canViewAssets"],
    ["estate settings", canOpenEstateSettings, "canManageEstate"],
  ] as const)("%s opens exactly with %s", (_, open, flag) => {
    expect(open({ ...managementOnly, [flag]: true })).toBe(true);
    expect(open({ ...managementOnly, [flag]: false })).toBe(false);
    expect(open(undefined)).toBe(false);
  });
});

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
    expect(assetsEntry(crewEstateAccess)).toBe("/estates/$estateId/assets");
    expect(assetsEntry({ ...managementOnly, canViewAssets: true })).toBe(
      "/estates/$estateId/assets"
    );
  });
  it("lands device viewers without asset access on All devices", () => {
    expect(assetsEntry({ ...managementOnly, canViewDevices: true })).toBe(
      "/estates/$estateId/assets/devices"
    );
  });
  it("is absent for everyone else", () => {
    expect(assetsEntry(managementOnly)).toBeUndefined();
    expect(assetsEntry(residentEstateAccess)).toBeUndefined();
    expect(assetsEntry(undefined)).toBeUndefined();
  });
});

describe("all readings", () => {
  // Linked from the Assets views, so it needs both readings and assets.
  it("is linked for readings viewers who can also view assets", () => {
    expect(canOpenAllReadings(ownerEstateAccess)).toBe(true);
    expect(
      canOpenAllReadings({
        ...managementOnly,
        canViewReadings: true,
        canViewAssets: true,
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
