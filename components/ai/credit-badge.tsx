import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";

export function CreditBadge({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Badge aria-label={label} className="tabular-nums" variant="secondary">
      <Icons.credit aria-hidden />
      {value}
    </Badge>
  );
}
