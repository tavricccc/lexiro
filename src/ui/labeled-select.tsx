import { Select, type SelectOption } from "design-kit";

/** A Select with its mono uppercase label above it, aligned with Field controls. */
export function LabeledSelect<Value extends string>({ label, value, options, onChange, disabled }: {
  label: string;
  value: Value;
  options: readonly SelectOption<Value>[];
  onChange: (value: Value) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <span aria-hidden className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">{label}</span>
      <Select className="h-11 w-full justify-between" disabled={disabled} label={label} onChange={onChange} options={options} value={value} />
    </div>
  );
}
