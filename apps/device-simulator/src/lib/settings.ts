import type { Mode } from "@/lib/readings";

export interface SimulatorSettings {
  apiUrl: string;
  deviceKey: string;
  mode: Mode;
}

export const SETTINGS_KEY = "device-simulator:settings";

export const DEFAULT_SETTINGS: SimulatorSettings = {
  apiUrl: "http://localhost:8080",
  deviceKey: "",
  mode: "backfill",
};

/**
 * Reads the settings saved in this browser. Missing, malformed or blocked
 * storage falls back to the defaults, field by field.
 */
export function loadSettings(): SimulatorSettings {
  let stored: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") {
      stored = parsed as Record<string, unknown>;
    }
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    apiUrl:
      typeof stored.apiUrl === "string"
        ? stored.apiUrl
        : DEFAULT_SETTINGS.apiUrl,
    deviceKey:
      typeof stored.deviceKey === "string"
        ? stored.deviceKey
        : DEFAULT_SETTINGS.deviceKey,
    mode:
      stored.mode === "backfill" || stored.mode === "live"
        ? stored.mode
        : DEFAULT_SETTINGS.mode,
  };
}

/** Saves the settings in this browser; blocked storage is ignored. */
export function saveSettings(settings: SimulatorSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode, blocked site data): keep running.
  }
}
