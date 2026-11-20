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
// Solid hue faces with a darker edge, like the app's buttons.
const HUE_CLASS: Record<SetHue, string> = {
  rose: "bg-hue-rose shadow-[0_3px_0_color-mix(in_oklab,var(--hue-rose)_70%,black)]",
  amber: "bg-hue-amber shadow-[0_3px_0_color-mix(in_oklab,var(--hue-amber)_70%,black)]",
  mint: "bg-hue-mint shadow-[0_3px_0_color-mix(in_oklab,var(--hue-mint)_70%,black)]",
  sky: "bg-hue-sky shadow-[0_3px_0_color-mix(in_oklab,var(--hue-sky)_70%,black)]",
  violet: "bg-hue-violet shadow-[0_3px_0_color-mix(in_oklab,var(--hue-violet)_70%,black)]",
};

/** A set's icon on its hue, as on its card. */
export function SetIcon({ hue, icon, className }: { hue: SetHue; icon: SetIconName; className?: string }) {
  const Component = SET_ICON_COMPONENTS[icon] ?? Books;
  return (
    <span aria-hidden className={cn("grid size-12 shrink-0 place-items-center rounded-2xl text-white [&_svg]:size-7", HUE_CLASS[hue] ?? HUE_CLASS.mint, className)}>
      <Component weight="fill" />
    </span>
  );
}
