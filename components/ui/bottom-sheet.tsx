import { Dialog } from "radix-ui";
import {
  useRef,
  type ComponentPropsWithoutRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

interface SwipeableSheetContentProps
  extends ComponentPropsWithoutRef<typeof Dialog.Content> {
  onDismiss?: () => void;
  children: ReactNode;
  showGrabber?: boolean;
}

function findScrollableAncestor(
  target: EventTarget | null,
  root: HTMLElement | null,
): HTMLElement | null {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== root) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  if (root && root.scrollHeight > root.clientHeight) return root;
  return null;
}

function isInteractiveControl(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, [role='slider'], [data-no-sheet-drag]",
    ),
  );
}

/**
 * A Dialog.Content that supports native-style pull-down to dismiss on mobile
 * and tablet viewports while preserving full Radix Dialog accessibility.
 */
export function SwipeableSheetContent({
  className,
  children,
  onDismiss,
  showGrabber = true,
  ...props
}: SwipeableSheetContentProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{
    pointerId: number;
    startY: number;
    startX: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    dragging: boolean;
    fromHandle: boolean;
    scroller: HTMLElement | null;
  } | null>(null);

  const resetTransform = (animate = true) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const scrim = sheet.closest<HTMLElement>(".scrim");
    if (animate) {
      sheet.style.transition =
        "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)";
      if (scrim) scrim.style.transition = "opacity 220ms ease";
    } else {
      sheet.style.transition = "";
      if (scrim) scrim.style.transition = "";
    }
    sheet.style.transform = "";
    if (scrim) scrim.style.opacity = "";
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if (isInteractiveControl(event.target)) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const fromHandle = Boolean(
      event.target instanceof Element &&
        event.target.closest("[data-sheet-grabber], .sheet-head, .record-bar"),
    );
    // On wide desktop screens where sheets are centered modals, only drag via grabber if shown.
    if (
      window.matchMedia?.("(min-width: 40rem)").matches &&
      !fromHandle
    ) {
      return;
    }
    const scroller = findScrollableAncestor(event.target, sheet);
    if (!fromHandle && scroller && scroller.scrollTop > 2) return;

    dragState.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocityY: 0,
      dragging: false,
      fromHandle,
      scroller,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    const sheet = sheetRef.current;
    if (!state || !sheet || event.pointerId !== state.pointerId) return;

    const dy = event.clientY - state.startY;
    const dx = event.clientX - state.startX;

    if (!state.dragging) {
      // Wait for intentional vertical downward pull
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        dragState.current = null;
        return;
      }
      if (dy < 8) return;
      if (!state.fromHandle && state.scroller && state.scroller.scrollTop > 2) {
        dragState.current = null;
        return;
      }
      state.dragging = true;
      try {
        sheet.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic events in tests may not implement setPointerCapture
      }
    }

    const now = performance.now();
    const dt = Math.max(1, now - state.lastTime);
    state.velocityY = (event.clientY - state.lastY) / dt;
    state.lastY = event.clientY;
    state.lastTime = now;

    const offset = dy > 0 ? dy : dy * 0.16;
    sheet.style.transition = "none";
    sheet.style.transform = `translate3d(0, ${offset}px, 0)`;

    const scrim = sheet.closest<HTMLElement>(".scrim");
    if (scrim && dy > 0) {
      scrim.style.transition = "none";
      const progress = Math.min(0.65, dy / 420);
      scrim.style.opacity = String(1 - progress);
    }
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    dragState.current = null;
    const sheet = sheetRef.current;
    if (!state || !state.dragging || !sheet) return;

    try {
      if (sheet.hasPointerCapture?.(event.pointerId)) {
        sheet.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore
    }

    const dy = event.clientY - state.startY;
    const threshold = Math.min(130, (sheet.offsetHeight || 400) * 0.26);
    const shouldClose =
      dy > threshold || (dy > 36 && state.velocityY > 0.48);

    if (shouldClose && onDismiss) {
      resetTransform(false);
      onDismiss();
    } else {
      resetTransform(true);
    }
  };

  return (
    <Dialog.Content
      ref={sheetRef}
      className={cn("sheet", className)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      {...props}
    >
      {showGrabber && (
        <div
          aria-hidden="true"
          className="sheet-grabber"
          data-sheet-grabber=""
        />
      )}
      {children}
    </Dialog.Content>
  );
}
