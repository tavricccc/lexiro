import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/cn";

const buttonVariants = cva("btn [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5", {
  variants: {
    variant: { default: "btn-primary", destructive: "btn-danger", outline: "btn-glass", secondary: "btn-secondary", ghost: "btn-ghost", glass: "btn-glass", link: "btn-ghost" },
    size: { default: "", xs: "btn-compact", sm: "btn-compact", lg: "btn-lg", icon: "btn-icon", "icon-xs": "btn-icon btn-compact", "icon-sm": "btn-icon btn-compact", "icon-lg": "btn-icon btn-lg" },
  }, defaultVariants: { variant: "default", size: "default" },
});

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-control-label=""
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
