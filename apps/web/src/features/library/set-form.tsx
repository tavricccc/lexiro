import { SET_ICONS, type Folder, type SetHue, type SetIcon as SetIconName } from "@lexiro/contract";
import { Field, Input, cn } from "design-kit";
import { SET_ICON_COMPONENTS, SetIcon } from "@/ui/set-icon";
import { FolderPickerField } from "./folder-picker";

export interface SetFormValue {
  name: string;
  folderId: string | null;
  hue: SetHue;
  icon: SetIconName;
}

const ICON_LABELS: Record<SetIconName, string> = {
  books: "書本", "graduation-cap": "學士帽", briefcase: "公事包", "bookmark-simple": "書籤", "airplane-tilt": "飛機", newspaper: "報紙",
};

/** Name, folder, and icon of a set. */
export function SetForm({ value, onChange, folders, error, online = true }: {
  value: SetFormValue;
  onChange: (value: SetFormValue) => void;
  folders: Folder[];
  error?: string;
  online?: boolean;
}) {
  return (
    <div className="grid gap-6">
      <div className="flex items-end gap-4">
        <SetIcon className="size-14 [&_svg]:size-8" icon={value.icon} />
        <div className="min-w-0 flex-1">
          <Field error={error} label="名稱">
            {({ id, describedBy, invalid }) => (
              <Input aria-describedby={describedBy} aria-invalid={invalid} id={id} maxLength={200} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="例如：第三課、多益 600" value={value.name} />
            )}
          </Field>
        </div>
      </div>
      <FolderPickerField
        canCreate={online}
        disabled={!online}
        folders={folders}
        onChange={(folderId) => onChange({ ...value, folderId })}
        value={value.folderId}
      />
      <fieldset className="grid gap-2">
        <legend className="mb-2 px-1 text-sm font-medium text-ink-muted">圖示</legend>
        <div className="grid grid-cols-6 gap-2">
          {SET_ICONS.map((icon) => {
            const Component = SET_ICON_COMPONENTS[icon];
            const selected = value.icon === icon;
            return (
              <label className="cursor-pointer" key={icon}>
                <input checked={selected} className="peer sr-only" name="icon" onChange={() => onChange({ ...value, icon })} type="radio" />
                <span className={cn("grid aspect-square place-items-center rounded-tile border transition-[background-color,border-color,color,scale] duration-[var(--motion-control)] active:scale-[var(--motion-press-scale)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--focus-ring)] [&_svg]:size-6", selected ? "border-contrast bg-accent-soft text-accent-ink" : "border-line text-ink-muted hover:bg-surface-raised")}>
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
