import * as React from "react";
import { cn } from "../lib/utils";

type AnyProps = Record<string, unknown>;

/** Hands its props to its only child, merging classes and chaining handlers. */
export function Slot({ children, ...props }: AnyProps & { children?: React.ReactNode }) {
  const child = React.Children.only(children) as React.ReactElement<AnyProps>;
  const own = child.props;
  const merged: AnyProps = { ...props, ...own };
  for (const key of Object.keys(props)) {
    const outer = props[key], inner = own[key];
    if (/^on[A-Z]/.test(key) && typeof outer === "function" && typeof inner === "function")
      merged[key] = (...args: unknown[]) => { (inner as (...a: unknown[]) => void)(...args); (outer as (...a: unknown[]) => void)(...args); };
  }
  merged.className = cn(props.className as string, own.className as string);
  return React.cloneElement(child, merged);
}
