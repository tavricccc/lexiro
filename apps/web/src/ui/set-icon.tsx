import { AirplaneTilt, BookmarkSimple, Books, Briefcase, GraduationCap, Newspaper, type Icon } from "@phosphor-icons/react";
import type { SetIcon as SetIconName } from "@lexiro/contract";
import { cn } from "design-kit";

export const SET_ICON_COMPONENTS: Record<SetIconName, Icon> = {
  books: Books,
  "graduation-cap": GraduationCap,
  briefcase: Briefcase,
  "bookmark-simple": BookmarkSimple,
  "airplane-tilt": AirplaneTilt,
  newspaper: Newspaper,
};

/** A set's icon, as on its card. Every set shares the accent; the icon tells them apart. */
export function SetIcon({ icon, className }: { icon: SetIconName; className?: string }) {
  const Component = SET_ICON_COMPONENTS[icon] ?? Books;
  return (
    <span aria-hidden className={cn("grid size-11 shrink-0 place-items-center rounded-tile [&_svg]:size-6", "bg-surface-raised text-ink", className)}>
      <Component weight="duotone" />
    </span>
  );
}
