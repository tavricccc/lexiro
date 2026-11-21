import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Check } from "@phosphor-icons/react/ssr";
import { Slot } from "radix-ui";
import { cn } from "../lib/utils";
import { Spinner } from "./feedback";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-none font-semibold tracking-[-0.01em] whitespace-nowrap outline-none select-none transition-[background-color,border-color,color,opacity,transform] duration-[var(--motion-control)] ease-[var(--ease-move)] active:scale-[var(--motion-press-scale)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--canvas)] disabled:pointer-events-none disabled:opacity-35 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.0625rem]",
  {
    variants: {
      variant: {
        primary: "border border-contrast bg-contrast text-on-contrast hover:border-ink hover:bg-ink hover:text-surface",
        secondary: "border border-line-strong bg-surface text-ink hover:bg-ink hover:text-surface",
        ghost: "border border-transparent text-ink-muted hover:border-line hover:bg-surface-raised hover:text-ink",
        danger: "border border-danger bg-danger/10 text-danger hover:bg-danger hover:text-white",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-10 px-4 text-[0.9375rem]",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

/** Where the action the button started has got to; anything but `idle` holds the button. */
export type ActionStatus = "idle" | "loading" | "success";

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; status?: ActionStatus };

export function Button({
  asChild = false,
  children,
  className,
  disabled,
  size,
  status = "idle",
  type,
  variant,
  ...props
}: ButtonProps) {
  const className_ = cn(buttonVariants({ size, variant }), className);
  if (asChild) return <Slot.Root className={className_} {...props}>{children}</Slot.Root>;
  return (
    <button
      aria-busy={status === "loading" || undefined}
      className={className_}
      disabled={disabled || status !== "idle"}
      type={type ?? "button"}
      {...props}
    >
      {status === "loading" ? <Spinner className="size-4 border-current border-t-transparent" /> : null}
      {status === "success" ? <Check aria-hidden weight="bold" /> : null}
      {children}
    </button>
  );
}
