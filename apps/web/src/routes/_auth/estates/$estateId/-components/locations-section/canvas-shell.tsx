import { Button } from "@proj/ui/components/button";
import { Maximize, Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useCanvasView } from "@/routes/_auth/estates/$estateId/-components/locations-section/use-canvas-view";

/**
 * The estate canvas both views draw on: a dotted grid that pans by drag,
 * zooms with Ctrl/Cmd + wheel or pinch, and has overlay zoom controls and
 * keyboard shortcuts. Fills its card edge to edge.
 */
export function CanvasShell({ children }: { children: ReactNode }) {
  const { view, viewportRef, contentRef, zoomIn, zoomOut, fit, handlers } =
    useCanvasView();
  return (
    <div className="relative">
      <section
        aria-label="Estate canvas"
        className="focus-visible:ring-ring/50 relative h-[60vh] min-h-96 cursor-grab touch-none overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:20px_20px] outline-none select-none focus-visible:ring-[3px] focus-visible:ring-inset active:cursor-grabbing"
        ref={viewportRef}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so arrow keys and +/- pan and zoom the canvas
        tabIndex={0}
        {...handlers}
      >
        <div
          className="absolute top-0 left-0 w-max origin-top-left"
          ref={contentRef}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          }}
        >
          {children}
        </div>
      </section>
      <div className="absolute right-3 bottom-3 flex items-center gap-1">
        <Button
          aria-label="Zoom out"
          onClick={zoomOut}
          size="icon-sm"
          variant="outline"
        >
          <Minus aria-hidden="true" />
        </Button>
        <span
          aria-live="polite"
          className="bg-background/90 w-12 rounded-md border py-1 text-center text-xs font-medium tabular-nums"
        >
          {Math.round(view.zoom * 100)}%
        </span>
        <Button
          aria-label="Zoom in"
          onClick={zoomIn}
          size="icon-sm"
          variant="outline"
        >
          <Plus aria-hidden="true" />
        </Button>
        <Button
          aria-label="Fit to view"
          onClick={fit}
          size="icon-sm"
          variant="outline"
        >
          <Maximize aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
