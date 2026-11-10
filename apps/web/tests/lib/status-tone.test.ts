import { describe, expect, it } from "vitest";
import {
  alertResponseTone,
  assetConditionTone,
  badgeVariantFor,
  deviceStatusTone,
  duplicateReportTone,
  inspectionCheckTone,
  inspectionOutcomeTone,
  invitationTone,
  lifecycleTone,
  notificationTypeTone,
  readingFlagTone,
  readingImportOutcomeTone,
  readingSuspicionTone,
  reportUrgencyTone,
  type StatusTone,
  serviceDueTone,
  statusDotClassName,
  statusToneBadgeVariant,
  telemetryItemStatusTone,
  workOrderStatusLabel,
  workOrderStatusTone,
  workOrderTypeTone,
} from "@/lib/status-tone";

const RAW_PALETTE = /emerald|amber|blue-|green-|red-/u;

function expectMapping<K extends string>(
  record: Record<K, StatusTone>,
  expected: Record<K, StatusTone>
): void {
  expect(Object.keys(record).sort()).toEqual(Object.keys(expected).sort());
  for (const key of Object.keys(expected) as K[]) {
    expect([key, record[key]]).toEqual([key, expected[key]]);
  }
}

describe("statusToneBadgeVariant", () => {
  it("maps each tone to its Badge variant", () => {
    expect(statusToneBadgeVariant).toEqual({
      success: "success",
      warning: "warning",
      info: "info",
      danger: "destructive",
      neutral: "outline",
      muted: "secondary",
    });
  });

  it("falls back to outline for an unknown tone", () => {
    expect(badgeVariantFor(undefined)).toBe("outline");
    expect(badgeVariantFor("bogus" as StatusTone)).toBe("outline");
    expect(badgeVariantFor("warning")).toBe("warning");
  });
});

describe("statusDotClassName", () => {
  it("uses tokens, never raw palette colours", () => {
    for (const className of Object.values(statusDotClassName)) {
      expect(className).not.toMatch(RAW_PALETTE);
    }
    expect(statusDotClassName.success).toBe("bg-success");
    expect(statusDotClassName.warning).toBe("bg-warning");
    expect(statusDotClassName.info).toBe("bg-info");
    expect(statusDotClassName.danger).toBe("bg-destructive");
  });
});

describe("status-to-tone mappings", () => {
  it("report urgency", () => {
    expectMapping(reportUrgencyTone, {
      LOW: "neutral",
      MEDIUM: "info",
      HIGH: "warning",
      URGENT: "danger",
    });
  });

  it("report and work-order status", () => {
    expectMapping(workOrderStatusTone, {
      OPEN: "neutral",
      ASSIGNED: "info",
      IN_PROGRESS: "warning",
      CLOSED: "success",
    });
    expect(workOrderStatusLabel).toEqual({
      OPEN: "Open",
      ASSIGNED: "Assigned",
      IN_PROGRESS: "In progress",
      CLOSED: "Closed",
    });
  });

  it("asset condition", () => {
    expectMapping(assetConditionTone, {
      GOOD: "success",
      NEEDS_ATTENTION: "warning",
      FAULTY: "danger",
      UNASSESSED: "neutral",
    });
  });

  it("device status", () => {
    expectMapping(deviceStatusTone, {
      ONLINE: "success",
      OFFLINE: "danger",
      AWAITING_FIRST_READING: "info",
      DEACTIVATED: "muted",
    });
  });

  it("lifecycle", () => {
    expectMapping(lifecycleTone, {
      ACTIVE: "success",
      RETIRED: "muted",
      INACTIVE: "muted",
    });
  });

  it("inspection check", () => {
    expect(inspectionCheckTone("OVERDUE", null)).toBe("danger");
    expect(inspectionCheckTone("DUE", null)).toBe("info");
    expect(inspectionCheckTone("DONE", "PASS")).toBe("success");
    expect(inspectionCheckTone("DONE", "FAIL")).toBe("warning");
  });

  it("notification type and alert response", () => {
    expectMapping(notificationTypeTone, {
      ANOMALY: "danger",
      SERVICE_DUE: "info",
      REPAIR_PREDICTED: "warning",
      CHECK_REQUESTED: "info",
      CHECK_FAILED: "danger",
    });
    expectMapping(alertResponseTone, {
      NONE: "warning",
      ACKNOWLEDGED: "success",
      DISMISSED: "muted",
    });
  });

  it("duplicate report suspicion", () => {
    expectMapping(duplicateReportTone, {
      SUSPECTED: "warning",
      CONFIRMED: "muted",
    });
  });

  it("reading import rows", () => {
    expectMapping(readingImportOutcomeTone, {
      IMPORTED: "success",
      DUPLICATE: "muted",
      INVALID: "danger",
    });
    expectMapping(telemetryItemStatusTone, {
      CREATED: "success",
      ALREADY_STORED: "muted",
      INVALID: "danger",
      CONFLICT: "warning",
    });
  });

  it("suspect readings", () => {
    expectMapping(readingFlagTone, {
      ANOMALY: "danger",
      OUT_OF_RANGE: "danger",
      GAP: "warning",
      DUPLICATE_TIMESTAMP: "warning",
    });
    expectMapping(readingSuspicionTone, {
      SUSPECTED: "warning",
      CONFIRMED: "danger",
      REJECTED: "muted",
    });
  });

  it("service due", () => {
    expectMapping(serviceDueTone, {
      OVERDUE: "danger",
      DUE: "warning",
      NEVER_INSPECTED: "info",
    });
  });

  it("invitations, work-order type and inspection outcome", () => {
    expectMapping(invitationTone, { PENDING: "info", ACTIVE: "success" });
    expectMapping(workOrderTypeTone, {
      BREAKDOWN_REPAIR: "warning",
      PREVENTIVE: "info",
    });
    expectMapping(inspectionOutcomeTone, { PASS: "success", FAIL: "danger" });
  });
});
