"use client";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { ListActionRow, ListInputRow } from "@/components/ui/list";
import { t } from "@/lib/i18n";

/**
 * The example sentences of one sense, as rows of the list they belong to.
 *
 * A sentence is too long to sit on the right of its label, so its label goes
 * above it — but it is still a row of the group, not a boxed textarea floating
 * inside one. The delete control lives on the row it deletes.
 */
export function ExampleFields({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <>
      {values.map((example, index) => (
        <ListInputRow
          block
          key={index}
          label={t("wordEdit.example", { count: index + 1 })}
          placeholder={t("setEditor.examplePlaceholder")}
          onChange={(next) =>
            onChange(values.map((text, i) => (i === index ? next : text)))
          }
          trailing={
            values.length > 1 && (
              <Button
                aria-label={t("wordEdit.removeExample")}
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Icons.delete />
              </Button>
            )
          }
          value={example}
        />
      ))}
      <ListActionRow onClick={() => onChange([...values, ""])}>
        {t("wordEdit.addExample")}
      </ListActionRow>
    </>
  );
}
