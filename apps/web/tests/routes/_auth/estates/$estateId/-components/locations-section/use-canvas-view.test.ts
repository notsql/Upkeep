import { describe, expect, it } from "vitest";
import {
  clampZoom,
  fitView,
  zoomAround,
} from "@/routes/_auth/estates/$estateId/-components/locations-section/use-canvas-view";

describe("canvas view helpers", () => {
  it("clamps zoom to 25%-200%", () => {
    expect(clampZoom(0.1)).toBe(0.25);
    expect(clampZoom(3)).toBe(2);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it("zooms around a point, keeping it fixed", () => {
    const view = { x: 10, y: 20, zoom: 1 };
    const next = zoomAround(view, 2, { x: 110, y: 120 });
    expect(next).toEqual({ x: -90, y: -80, zoom: 2 });
    // The content point under the pointer (100, 100) stays under it.
    expect((110 - next.x) / next.zoom).toBe(100);
  });

  it("clamps the zoom when zooming around a point", () => {
    expect(zoomAround({ x: 0, y: 0, zoom: 2 }, 5, { x: 0, y: 0 }).zoom).toBe(2);
  });

  it("fits content inside the viewport, centred, never above 100%", () => {
    expect(
      fitView({ width: 400, height: 200 }, { width: 1000, height: 600 }, 0)
    ).toEqual({ x: 300, y: 200, zoom: 1 });
    expect(
      fitView({ width: 2000, height: 500 }, { width: 1000, height: 600 }, 0)
    ).toEqual({ x: 0, y: 175, zoom: 0.5 });
  });

  it("defaults to 100% at the origin without layout", () => {
    expect(
      fitView({ width: 0, height: 0 }, { width: 0, height: 0 }, 24)
    ).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});
