import { act } from "@testing-library/react";

interface FakeObserver {
  callback: IntersectionObserverCallback;
  targets: Set<Element>;
}

export const observers = new Set<FakeObserver>();

/** Scrolls every observed element into view, firing its observer. */
export function intersect() {
  act(() => {
    for (const observer of [...observers]) {
      const entries = [...observer.targets].map(
        (target) =>
          ({ isIntersecting: true, target }) as IntersectionObserverEntry
      );
      if (entries.length > 0) {
        observer.callback(entries, observer as unknown as IntersectionObserver);
      }
    }
  });
}
