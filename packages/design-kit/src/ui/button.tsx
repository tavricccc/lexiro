import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Check } from "@phosphor-icons/react/ssr";
import { Button as ButtonRoot } from "@ui-sdk/react/button";
import { cn } from "../lib/utils";
import { Spinner } from "./feedback";
import { Slot } from "./slot";

// Tactile buttons: a darker edge sits under the face and the press pushes the face into it.
export const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl font-bold whitespace-nowrap outline-none select-none transition-[background-color,color,translate,box-shadow,filter] duration-[var(--motion-touch)] ease-[var(--ease-move)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-40 data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-[1.125rem]",
  {
    variants: {
      variant: {
        primary: "bg-contrast text-on-contrast shadow-[0_4px_0_var(--contrast-edge)] hover:brightness-105 active:translate-y-1 active:shadow-[0_0_0_var(--contrast-edge)]",
        secondary: "border-2 border-line bg-surface text-ink shadow-[0_4px_0_var(--line-strong)] hover:bg-surface-raised active:translate-y-1 active:shadow-[0_0_0_var(--line-strong)]",
        ghost: "text-ink-muted hover:bg-surface-raised hover:text-ink active:scale-95",
        danger: "bg-danger text-on-danger shadow-[0_4px_0_var(--danger-edge)] hover:brightness-105 active:translate-y-1 active:shadow-[0_0_0_var(--danger-edge)]",
      },
      size: {
        sm: "h-9 rounded-xl px-4 text-sm",
        md: "h-12 px-5 text-[0.9375rem]",
        lg: "h-14 px-7 text-base tracking-wide",
        icon: "size-12",
        "icon-sm": "size-10 rounded-xl",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ActionStatus = "idle" | "loading" | "success";

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; status?: ActionStatus };

export function Button({ asChild = false, children, className, disabled, size, status = "idle", type, variant, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ size, variant }), className);
  if (asChild) return <Slot className={classes} {...props}>{children}</Slot>;
  return (
    <ButtonRoot
      {...(props as object)}
      aria-busy={status === "loading" || undefined}
      className={classes}
      disabled={disabled || status !== "idle"}
      type={type === "submit" || type === "reset" ? type : "button"}
    >
      {status === "loading" ? <Spinner className="size-4 border-current border-t-transparent" /> : null}
      {status === "success" ? <Check aria-hidden weight="bold" /> : null}
      {children}
    </ButtonRoot>
  );
}
