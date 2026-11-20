import * as React from "react";
import { Tooltip as TooltipRoot, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";

export function Tooltip({ children, label }: { children: React.ReactElement; label: string }) {
  return (
    <TooltipRoot delay={400}>
      <TooltipTrigger render={children} />
      <TooltipContent className="pointer-events-none z-50 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-canvas transition-[opacity,scale] duration-150 data-starting-style:scale-90 data-starting-style:opacity-0 data-ending-style:opacity-0" sideOffset={8}>
        {label}
      </TooltipContent>
    </TooltipRoot>
  );
}
