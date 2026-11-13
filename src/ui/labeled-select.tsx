import { Select, type SelectOption } from "design-kit";

/** A Select with its label above it, lined up with Field controls. */
export function LabeledSelect<Value extends string>({ label, value, options, onChange, disabled }: {
  label: string;
  value: Value;
  options: readonly SelectOption<Value>[];
  onChange: (value: Value) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <span aria-hidden className="px-1 text-sm font-medium text-ink-muted">{label}</span>
      <Select className="h-12 w-full justify-between rounded-tile border border-line" disabled={disabled} label={label} onChange={onChange} options={options} value={value} />
    </div>
  );
}
