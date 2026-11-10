import { renderHook } from "@testing-library/react";
import { mockMobileViewport } from "@tests/mock-viewport";
import { afterEach, expect, it, vi } from "vitest";
import { useMobile } from "@/lib/use-mobile";

afterEach(() => {
  vi.restoreAllMocks();
});

it("reports a phone-width viewport and follows resizes", () => {
  const resize = mockMobileViewport(true);
  const { result } = renderHook(() => useMobile());
  expect(result.current).toBe(true);
  resize(false);
  expect(result.current).toBe(false);
});
