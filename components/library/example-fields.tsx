import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export function ExampleFields({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      {values.map((example, index) => (
        <div className="flex items-end gap-2" key={index}>
          <Field
            className="min-w-0 flex-1"
            label={t("wordEdit.example", { count: index + 1 })}
          >
            <Textarea
              rows={2}
              className="min-h-20"
              value={example}
              onChange={(event) =>
                onChange(
                  values.map((text, i) =>
                    i === index ? event.target.value : text,
                  ),
                )
              }
            />
          </Field>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("wordEdit.removeExample")}
            onClick={() => onChange(values.filter((_, i) => i !== index))}
          >
            <Icons.delete />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => onChange([...values, ""])}
      >
        <Icons.create />
        {t("wordEdit.addExample")}
      </Button>
    </div>
  );
}
