import { act } from "@testing-library/react";
import { vi } from "vitest";

export function mockMobileViewport(initial = true) {
  let mobile = initial;
  const listeners = new Set<() => void>();
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    get matches() {
      return query === "(max-width: 767px)" && mobile;
    },
    media: query,
    onchange: null,
    addEventListener: (
      _type: string,
      listener: EventListenerOrEventListenerObject | null
    ) => {
      if (typeof listener === "function") {
        listeners.add(listener as () => void);
      }
    },
    removeEventListener: (
      _type: string,
      listener: EventListenerOrEventListenerObject | null
    ) => {
      listeners.delete(listener as () => void);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
  return (value: boolean) =>
    act(() => {
      mobile = value;
      for (const listener of listeners) {
        listener();
      }
    });
}
