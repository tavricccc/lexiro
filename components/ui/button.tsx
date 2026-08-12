import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-[background-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white shadow-[0_8px_22px_rgb(63_117_104/0.18)] hover:bg-brand-strong",
        secondary: "bg-brand-soft text-ink hover:bg-brand-soft/75",
        ghost: "text-ink-muted hover:bg-ink/5 hover:text-ink",
      },
      size: {
        default: "h-11",
        icon: "size-11 p-0",
        sm: "h-9 min-h-9 px-4 text-xs",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ asChild, className, variant, size, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
