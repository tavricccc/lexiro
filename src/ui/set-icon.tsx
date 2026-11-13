import { AirplaneTilt, BookmarkSimple, Books, Briefcase, GraduationCap, Newspaper, type Icon } from "@phosphor-icons/react";
import type { SetHue, SetIcon as SetIconName } from "@lexiro/contract";
import { cn } from "design-kit";

export const SET_ICON_COMPONENTS: Record<SetIconName, Icon> = {
  books: Books,
  "graduation-cap": GraduationCap,
  briefcase: Briefcase,
  "bookmark-simple": BookmarkSimple,
  "airplane-tilt": AirplaneTilt,
  newspaper: Newspaper,
};
export const HUE_LABELS: Record<SetHue, string> = { rose: "玫瑰", amber: "琥珀", mint: "薄荷", sky: "天空", violet: "紫羅蘭" };
const HUE_CLASS: Record<SetHue, string> = {
  rose: "bg-hue-rose/15 text-hue-rose",
  amber: "bg-hue-amber/15 text-hue-amber",
  mint: "bg-hue-mint/15 text-hue-mint",
  sky: "bg-hue-sky/15 text-hue-sky",
  violet: "bg-hue-violet/15 text-hue-violet",
};

/** A set's icon on its hue, as on its card. */
export function SetIcon({ hue, icon, className }: { hue: SetHue; icon: SetIconName; className?: string }) {
  const Component = SET_ICON_COMPONENTS[icon] ?? Books;
  return (
    <span aria-hidden className={cn("grid size-11 shrink-0 place-items-center rounded-tile [&_svg]:size-6", HUE_CLASS[hue] ?? HUE_CLASS.mint, className)}>
      <Component weight="duotone" />
    </span>
  );
}
