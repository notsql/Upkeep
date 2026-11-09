import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface CanvasView {
  x: number;
  y: number;
  zoom: number;
}
interface Point {
  x: number;
  y: number;
}
interface Size {
  height: number;
  width: number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;
const PAN_STEP = 40;
const FIT_PADDING = 24;
const ORIGIN: CanvasView = { x: 0, y: 0, zoom: 1 };
const PAN_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [PAN_STEP, 0],
  ArrowRight: [-PAN_STEP, 0],
  ArrowUp: [0, PAN_STEP],
  ArrowDown: [0, -PAN_STEP],
};
const ZOOM_KEYS: Record<string, "in" | "out" | "fit"> = {
  "+": "in",
  "=": "in",
  "-": "out",
  "0": "fit",
};
/** Drags starting on these stay clicks. */
const INTERACTIVE = "button, a, input, [role=menuitem]";

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Zooms so the content point under `point` (viewport coords) stays there. */
export function zoomAround(
  view: CanvasView,
  zoom: number,
  point: Point
): CanvasView {
  const next = clampZoom(zoom);
  const scale = next / view.zoom;
  return {
    x: point.x - (point.x - view.x) * scale,
    y: point.y - (point.y - view.y) * scale,
    zoom: next,
  };
}

/** Centres the content in the viewport, scaled down to fit (never above 100%). */
export function fitView(
  content: Size,
  viewport: Size,
  padding: number
): CanvasView {
  if (!(content.width && content.height && viewport.width && viewport.height)) {
    return ORIGIN;
  }
  const zoom = clampZoom(
    Math.min(
      1,
      (viewport.width - padding * 2) / content.width,
      (viewport.height - padding * 2) / content.height
    )
  );
  return {
    x: (viewport.width - content.width * zoom) / 2,
    y: (viewport.height - content.height * zoom) / 2,
    zoom,
  };
}

/**
 * Pan and zoom for the estate canvas: drag to pan, Ctrl/Cmd + wheel or pinch
 * to zoom around the pointer, keyboard and button controls. Fits on load and
 * whenever the content resizes until the user moves the view.
 */
export function useCanvasView() {
  const viewportRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<CanvasView>(ORIGIN);
  const moved = useRef(false);
  const drag = useRef<Point | null>(null);

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!(viewport && content)) {
      return;
    }
    setView(
      fitView(
        { width: content.offsetWidth, height: content.offsetHeight },
        { width: viewport.clientWidth, height: viewport.clientHeight },
        FIT_PADDING
      )
    );
  }, []);

  const move = useCallback((update: (view: CanvasView) => CanvasView) => {
    moved.current = true;
    setView(update);
  }, []);

  const zoomBy = useCallback(
    (step: number) => {
      const viewport = viewportRef.current;
      const centre = {
        x: (viewport?.clientWidth ?? 0) / 2,
        y: (viewport?.clientHeight ?? 0) / 2,
      };
      move((current) => zoomAround(current, current.zoom + step, centre));
    },
    [move]
  );
  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(-ZOOM_STEP), [zoomBy]);
  const pan = useCallback(
    (dx: number, dy: number) =>
      move((current) => ({ ...current, x: current.x + dx, y: current.y + dy })),
    [move]
  );

  useLayoutEffect(() => {
    fit();
    const content = contentRef.current;
    if (!(content && typeof ResizeObserver !== "undefined")) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (!moved.current) {
        fit();
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [fit]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      move((current) =>
        zoomAround(
          current,
          current.zoom * Math.exp(-event.deltaY * 0.01),
          point
        )
      );
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [move]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if ((event.target as Element).closest(INTERACTIVE)) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
  }, []);
  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const last = drag.current;
      if (!last) {
        return;
      }
      drag.current = { x: event.clientX, y: event.clientY };
      pan(event.clientX - last.x, event.clientY - last.y);
    },
    [pan]
  );
  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      const step = PAN_KEYS[event.key];
      const zoom = ZOOM_KEYS[event.key];
      if (!(step || zoom)) {
        return;
      }
      event.preventDefault();
      if (step) {
        pan(step[0], step[1]);
      } else if (zoom === "in") {
        zoomIn();
      } else if (zoom === "out") {
        zoomOut();
      } else {
        fit();
      }
    },
    [pan, zoomIn, zoomOut, fit]
  );

  return {
    view,
    viewportRef,
    contentRef,
    zoomIn,
    zoomOut,
    fit,
    handlers: {
      onKeyDown,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
