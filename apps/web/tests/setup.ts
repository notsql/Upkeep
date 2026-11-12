import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { observers } from "./intersection";

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

// jsdom has no IntersectionObserver, which the mobile infinite-scroll sentinel
// needs. This stub never fires on its own; tests call `intersect()` from
// `tests/intersection.ts` to simulate scrolling the sentinel into view.
if (!("IntersectionObserver" in window)) {
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    value: class {
      readonly callback: IntersectionObserverCallback;
      readonly targets = new Set<Element>();
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        observers.add(this);
      }
      observe(target: Element) {
        this.targets.add(target);
      }
      unobserve(target: Element) {
        this.targets.delete(target);
      }
      disconnect() {
        this.targets.clear();
        observers.delete(this);
      }
    },
  });
}

// jsdom has no ResizeObserver or scrollIntoView; cmdk (the shadcn Command list) calls both.
if (!("ResizeObserver" in window)) {
  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    value: function ResizeObserver() {
      return {
        observe: () => undefined,
        unobserve: () => undefined,
        disconnect: () => undefined,
      };
    },
  });
}
Element.prototype.scrollIntoView ??= () => undefined;
