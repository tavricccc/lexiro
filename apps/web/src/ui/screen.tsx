import { createContext, useContext, useRef } from "react";
import { EdgeBlur } from "design-kit";
import type { Presentation } from "@/app/hierarchy";
import { OfflineBanner } from "./offline-banner";
import { ScrollMore } from "./scroll-more";

export interface ScreenInfo {
  presentation: Presentation;
  /** The screen in use: not covered by another, and not on its way out. */
  active: boolean;
}

/** The screen a component is drawn on. Outside the stage, a page of its own. */
export const ScreenContext = createContext<ScreenInfo>({ presentation: "push", active: true });
export const useScreen = () => useContext(ScreenContext);

/** A screen's own scroll area: its content, the soft edges, and the arrow to the end. */
export function ScreenScroller({ children, hidden }: { children: React.ReactNode; hidden?: boolean }) {
  const { presentation } = useScreen();
  const scroller = useRef<HTMLDivElement>(null);
  // A full screen lays itself out to the edges.
  if (presentation === "full")
    return (
      <div className="screen-view">
        <div className="screen-scroller" ref={scroller}>{children}</div>
        <ScrollMore className="screen-more" target={scroller} />
      </div>
    );
  return (
    <div className="screen-view" data-hidden={hidden || undefined} inert={hidden}>
      {presentation === "tab" || presentation === "push" ? <OfflineBanner /> : null}
      <div className="screen-scroller" ref={scroller}>
        <div className="screen-top"><EdgeBlur className="screen-edge-top" side="top" /></div>
        <div className="screen-body">{children}</div>
      </div>
      <EdgeBlur className="screen-edge-bottom" side="bottom" />
      <ScrollMore className="screen-more" target={scroller} />
    </div>
  );
}
