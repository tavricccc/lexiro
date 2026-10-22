import { useTheme } from "next-themes";

import { ListPicker, ListSection } from "@/components/ui/list";
import { t } from "@/lib/i18n";

const THEMES = ["system", "light", "dark"] as const;
const THEME_LABEL = {
  system: "settings.system",
  light: "settings.light",
  dark: "settings.dark",
} as const;

export function PreferencesSection() {
  const { theme, setTheme } = useTheme();
  const current = (THEMES as readonly string[]).includes(theme ?? "")
    ? (theme as (typeof THEMES)[number])
    : "system";

  return (
    <div className="space-y-[var(--section-gap)]">
      <ListSection header={t("settings.appearance")}>
        <ListPicker
          label={t("settings.theme")}
          onChange={setTheme}
          options={THEMES.map((value) => ({
            label: t(THEME_LABEL[value]),
            value,
          }))}
          value={current}
        />
      </ListSection>
    </div>
  );
}
