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
export const HUE_LABELS: Record<SetHue, string> = { rose: "朱紅", amber: "赭黃", mint: "翠綠", sky: "克萊因藍", violet: "群青" };
const HUE_CLASS: Record<SetHue, string> = {
  rose: "bg-hue-rose text-white",
  amber: "bg-hue-amber text-white",
  mint: "bg-hue-mint text-white",
  sky: "bg-hue-sky text-white",
  violet: "bg-hue-violet text-white",
};
export const HUE_BAR: Record<SetHue, string> = {
  rose: "bg-hue-rose",
  amber: "bg-hue-amber",
  mint: "bg-hue-mint",
  sky: "bg-hue-sky",
  violet: "bg-hue-violet",
};

/** Sharp Bauhaus color-coded geometric set emblem. */
export function SetIcon({ hue, icon, className }: { hue: SetHue; icon: SetIconName; className?: string }) {
  const Component = SET_ICON_COMPONENTS[icon] ?? Books;
  return (
    <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-none [&_svg]:size-5", HUE_CLASS[hue] ?? HUE_CLASS.sky, className)}>
      <Component weight="bold" />
    </span>
  );
}
