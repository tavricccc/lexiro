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
        className={cn(
          "block size-full aspect-square object-cover",
          imageClassName,
        )}
        src="/icons/lexiro.png"
      />
    </span>
  );
}
