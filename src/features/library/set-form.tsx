import { Check } from "@phosphor-icons/react";
import { SET_HUES, SET_ICONS, type Folder, type SetHue, type SetIcon as SetIconName } from "@lexiro/contract";
import { Field, Input, cn } from "design-kit";
import { LabeledSelect } from "@/ui/labeled-select";
import { HUE_LABELS, SET_ICON_COMPONENTS, SetIcon } from "@/ui/set-icon";

export interface SetFormValue {
  name: string;
  folderId: string | null;
  hue: SetHue;
  icon: SetIconName;
}

const ICON_LABELS: Record<SetIconName, string> = {
  books: "書本", "graduation-cap": "學士帽", briefcase: "公事包", "bookmark-simple": "書籤", "airplane-tilt": "飛機", newspaper: "報紙",
};
const HUE_SWATCH: Record<SetHue, string> = { rose: "bg-hue-rose", amber: "bg-hue-amber", mint: "bg-hue-mint", sky: "bg-hue-sky", violet: "bg-hue-violet" };

/** Name, folder, colour and icon of a set. */
export function SetForm({ value, onChange, folders, error }: {
  value: SetFormValue;
  onChange: (value: SetFormValue) => void;
  folders: Folder[];
  error?: string;
}) {
  return (
    <div className="grid gap-6">
      <div className="flex items-end gap-4">
        <SetIcon className="size-14 [&_svg]:size-8" hue={value.hue} icon={value.icon} />
        <div className="min-w-0 flex-1">
          <Field error={error} label="名稱">
            {({ id, describedBy, invalid }) => (
              <Input aria-describedby={describedBy} aria-invalid={invalid} id={id} maxLength={200} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="例如：第三課、多益 600" value={value.name} />
            )}
          </Field>
        </div>
      </div>
      {folders.length ? (
        <LabeledSelect
          label="資料夾"
          onChange={(folderId) => onChange({ ...value, folderId: folderId === "none" ? null : folderId })}
          options={[{ value: "none", label: "不放資料夾" }, ...folders.map((folder) => ({ value: folder.id, label: folder.name }))]}
          value={value.folderId ?? "none"}
        />
      ) : null}
      <fieldset className="grid gap-2">
        <legend className="mb-2 px-1 text-sm font-medium text-ink-muted">顏色</legend>
        <div className="flex flex-wrap gap-3">
          {SET_HUES.map((hue) => (
            <label className="relative cursor-pointer" key={hue}>
              <input checked={value.hue === hue} className="peer sr-only" name="hue" onChange={() => onChange({ ...value, hue })} type="radio" />
              <span className={cn("grid size-11 place-items-center rounded-full text-white ring-offset-2 ring-offset-canvas peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--focus-ring)]", HUE_SWATCH[hue])}>
                {value.hue === hue ? <Check aria-hidden className="size-5" weight="bold" /> : null}
              </span>
              <span className="sr-only">{HUE_LABELS[hue]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-2 px-1 text-sm font-medium text-ink-muted">圖示</legend>
        <div className="grid grid-cols-6 gap-2">
          {SET_ICONS.map((icon) => {
            const Component = SET_ICON_COMPONENTS[icon];
            const selected = value.icon === icon;
            return (
              <label className="cursor-pointer" key={icon}>
                <input checked={selected} className="peer sr-only" name="icon" onChange={() => onChange({ ...value, icon })} type="radio" />
                <span className={cn("grid aspect-square place-items-center rounded-tile border transition-colors duration-[var(--motion-control)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--focus-ring)] [&_svg]:size-6", selected ? "border-contrast bg-accent-soft text-accent-ink" : "border-line text-ink-muted hover:bg-surface-raised")}>
                  <Component aria-hidden weight={selected ? "fill" : "regular"} />
                </span>
                <span className="sr-only">{ICON_LABELS[icon]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
