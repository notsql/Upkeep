import { describe, expect, it } from "vitest";
import {
  formatAssessmentNotes,
  formatClock,
  formatDate,
  formatDateTime,
  formatDayHour,
  formatMetricNumber,
  formatMetricValue,
  formatNumber,
  formatPercent,
  formatRelative,
  formatScore,
  formatTime,
} from "@/lib/format";

const SG = { locale: "en-SG", timeZone: "Asia/Singapore" };

describe("formatDate", () => {
  it.each(["Pacific/Honolulu", "Asia/Singapore", "Pacific/Kiritimati"])(
    "shows a date-only value as the same day in %s",
    (timeZone) => {
      expect(formatDate("2026-11-07", { locale: "en-SG", timeZone })).toBe(
        "7 Nov 2026"
      );
    }
  );

  it.each([
    "",
    "not a date",
    "2026-13-01",
    "2026-02-30",
    "2026-11-07T12:00:00Z",
    "7/11/2026",
  ])("returns %j unchanged", (value) => {
    expect(formatDate(value, SG)).toBe(value);
  });
});

describe("formatDateTime", () => {
  it("formats an instant in the given time zone with seconds", () => {
    expect(formatDateTime("2026-11-07T13:01:57.123Z", SG)).toBe(
      "7 Nov 2026, 9:01:57 pm"
    );
  });

  it("crosses the date line for the viewer's time zone", () => {
    expect(
      formatDateTime("2026-11-07T20:00:00Z", {
        locale: "en-SG",
        timeZone: "Pacific/Kiritimati",
      })
    ).toBe("8 Nov 2026, 10:00:00 am");
  });
});

describe("formatTime", () => {
  it("formats only the time with seconds", () => {
    expect(formatTime("2026-11-07T13:01:57Z", SG)).toBe("9:01:57 pm");
  });
});

describe("formatClock", () => {
  it("shows hours and minutes without seconds", () => {
    expect(formatClock("2026-11-07T13:01:57Z", SG)).toBe("9:01 pm");
  });
});

describe("formatPercent", () => {
  it("shows a fraction as a percent to 1 digit, signed on request", () => {
    expect(formatPercent(0.032, { ...SG, signed: true })).toBe("+3.2%");
    expect(formatPercent(-0.032, { ...SG, signed: true })).toBe("-3.2%");
    expect(formatPercent(0, { ...SG, signed: true })).toBe("0.0%");
    expect(formatPercent(0.1, SG)).toBe("10.0%");
  });
});

describe("formatDayHour", () => {
  it("shows a short day and hour for the 24 h chart axis", () => {
    expect(formatDayHour("2026-11-07T13:01:57Z", SG)).toBe("Sat, 9 pm");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-11-07T13:00:00Z");

  it.each([
    ["2026-11-07T12:59:30Z", "30 sec ago"],
    ["2026-11-07T12:58:00Z", "2 min ago"],
    ["2026-11-07T10:00:00Z", "3 hr ago"],
    ["2026-11-06T13:00:00Z", "yesterday"],
    ["2026-11-04T13:00:00Z", "3 days ago"],
    ["2026-11-07T13:02:00Z", "in 2 min"],
  ])("describes %s as %s", (instant, text) => {
    expect(formatRelative(instant, now, { locale: "en-SG" })).toBe(text);
  });
});

describe("formatMetricValue", () => {
  it.each([
    ["TEMPERATURE", 68.44, "68.4°C"],
    ["HUMIDITY", 55.4, "55%"],
    ["PRESSURE", -0.273_216, "-0.27 bar"],
    ["FLOW_RATE", 32, "32.0 L/min"],
    ["VIBRATION_ACCELERATION", 0.012_345_6, "0.0123 g"],
    ["VIBRATION_ACCELERATION", 1.5, "1.50 g"],
    ["VIBRATION", 4.1, "4.10 mm/s"],
    ["POWER", 0.336_89, "0.34 kW"],
    ["ENERGY", 1234.56, "1,234.6 kWh"],
  ] as const)("formats %s %s as %s", (metric, value, text) => {
    expect(formatMetricValue(metric, value, { locale: "en-SG" })).toBe(text);
  });

  it("parses a valueText decimal string", () => {
    expect(
      formatMetricValue("PRESSURE", "1.23456789", { locale: "en-SG" })
    ).toBe("1.23 bar");
  });
});

describe("formatMetricNumber", () => {
  it.each([
    ["TEMPERATURE", 68.44, "68.4"],
    ["HUMIDITY", 55.4, "55"],
    ["PRESSURE", "1.23456789", "1.23"],
  ] as const)("formats %s %s as %s without the unit", (metric, value, text) => {
    expect(formatMetricNumber(metric, value, { locale: "en-SG" })).toBe(text);
  });
});

describe("formatScore", () => {
  it.each([
    [0.8734, "0.87"],
    [0.875, "0.88"],
    [1, "1.00"],
  ])("formats %s as %s", (score, text) => {
    expect(formatScore(score, { locale: "en-SG" })).toBe(text);
  });
});

describe("formatNumber", () => {
  it("groups thousands and keeps up to three fraction digits", () => {
    expect(formatNumber(1234.5678, { locale: "en-SG" })).toBe("1,234.568");
  });
});

describe("formatAssessmentNotes", () => {
  const model = "system:anomaly-model";
  // Verbatim shape of the note AnomalyScoringService.assess writes.
  const oldNote =
    "11 consecutive abnormal samples in device readings from 2026-11-07T12:59:15.862Z to 2026-11-07T12:59:25.862Z. Median score 0.82, maximum 0.88.";

  it("formats a model note's instants, the second as a time on the same day", () => {
    expect(
      formatAssessmentNotes({ notes: oldNote, recordedByUserId: model }, SG)
    ).toBe(
      "11 consecutive abnormal samples in device readings from 7 Nov 2026, 8:59:15 pm to 8:59:25 pm. Median score 0.82, maximum 0.88."
    );
  });

  it("keeps the full date on both instants across local days", () => {
    const notes =
      "3 consecutive abnormal samples in device readings from 2026-11-07T15:59:59Z to 2026-11-07T16:00:01Z. Median score 0.60, maximum 0.70.";
    expect(formatAssessmentNotes({ notes, recordedByUserId: model }, SG)).toBe(
      "3 consecutive abnormal samples in device readings from 7 Nov 2026, 11:59:59 pm to 8 Nov 2026, 12:00:01 am. Median score 0.60, maximum 0.70."
    );
  });

  it("shows a person's notes exactly as typed", () => {
    expect(
      formatAssessmentNotes({ notes: oldNote, recordedByUserId: "user_01" }, SG)
    ).toBe(oldNote);
  });

  it("shows a model note with no instant unchanged", () => {
    const notes = "Pump sounded fine.";
    expect(formatAssessmentNotes({ notes, recordedByUserId: model }, SG)).toBe(
      notes
    );
  });

  it("treats missing notes as empty", () => {
    expect(formatAssessmentNotes({ recordedByUserId: model }, SG)).toBe("");
  });
});
