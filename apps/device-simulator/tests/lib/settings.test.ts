import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  SETTINGS_KEY,
  saveSettings,
} from "@/lib/settings";

afterEach(() => {
  localStorage.clear();
});

describe("simulator settings", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips the API URL, device key and mode", () => {
    const settings = {
      apiUrl: "https://api.example.com",
      deviceKey: "dk_secret",
      mode: "live" as const,
    };
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  it("falls back to the defaults for malformed or partial data", () => {
    localStorage.setItem(SETTINGS_KEY, "{not json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ apiUrl: 42, deviceKey: "dk", mode: "sideways" })
    );
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, deviceKey: "dk" });
  });

  it("ignores storage that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
