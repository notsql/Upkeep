import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-cleans when a global `afterEach` exists, and we run
// without Vitest globals - so unmount explicitly. Without this, components from
// earlier tests stay in the document and queries match the wrong node.
afterEach(() => {
  cleanup();
});

// jsdom has no matchMedia, which next-themes calls for `enableSystem` - so
// every renderWithProviders call would throw without this stub.
window.matchMedia ??= (query: string): MediaQueryList =>
  ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  }) satisfies MediaQueryList;
