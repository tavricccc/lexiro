import Link from "next/link";

import { cn } from "@/lib/cn";

export function BrandMark({
  className,
  imageClassName,
}: {
  className?: string;
  imageClassName?: string;
}) {
  return (
    <span
      aria-hidden
      // The mark is a full-bleed asset, so it is clipped rather than padded
      // inside a plate, and never colour-inverted -- inverting turns the brand
      // mark into a different mark.
      className={cn(
        "block size-9 aspect-square shrink-0 overflow-hidden rounded-[var(--radius-control)] shadow-[var(--shadow-control)]",
        className,
      )}
    >
      <img
        alt=""
        className={cn("block size-full aspect-square object-cover", imageClassName)}
        src="/icons/lexiro.png"
      />
    </span>
  );
}

export function BrandLockup({
  className,
  href,
  markClassName,
}: {
  className?: string;
  href?: string;
  markClassName?: string;
}) {
  const content = (
    <>
      <BrandMark className={markClassName} />
      <span className="text-lg font-medium leading-none tracking-[-0.01em]">
        Lexiro
      </span>
    </>
  );

  if (!href) {
    return <div className={cn("flex items-center gap-2.5", className)}>{content}</div>;
  }

  return (
    <Link
      className={cn(
        "group flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
      href={href}
    >
      {content}
    </Link>
  );
}
