import { Check } from "@phosphor-icons/react";
import { t } from "@/lib/i18n";
import type { LibrarySet } from "@/types";
import { setIcons } from "./primitives";

export function SetAppearancePicker({
  hue = "mint",
  icon = "books",
  onChange,
}: Pick<LibrarySet, "hue" | "icon"> & {
  onChange: (value: Pick<LibrarySet, "hue" | "icon">) => void;
}) {
  return (
    <div className="tile stack">
      <h3>{t("redesign.colour")}</h3>
      <div className="palette">
        {(["rose", "amber", "mint", "sky", "violet"] as const).map((c) => (
          <button
            key={c}
            type="button"
            className={`hue-${c}`}
            aria-label={c}
            aria-pressed={hue === c}
            onClick={() => onChange({ hue: c, icon })}
          >
            <span className="swatch">{hue === c && <Check weight="bold" size={16} />}</span>
          </button>
        ))}
      </div>
      <h3>{t("redesign.icon")}</h3>
      <div className="palette">
        {Object.entries(setIcons).map(([key, Icon]) => (
          <button
            type="button"
            key={key}
            aria-label={key}
            aria-pressed={icon === key}
            onClick={() => onChange({ hue, icon: key as LibrarySet["icon"] })}
          >
            <Icon size={24} weight="regular" />
          </button>
        ))}
      </div>
    </div>
  );
}
