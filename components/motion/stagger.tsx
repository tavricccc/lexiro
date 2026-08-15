import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function StaggerList({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("t-stagger-list", className)} {...props} />;
}

export function StaggerItem({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("t-stagger-item", className)} {...props} />;
}
