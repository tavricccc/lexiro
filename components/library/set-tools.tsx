"use client";

import { Icons } from "@/components/ui/icons";
import { ListNavRow, ListSection } from "@/components/ui/list";
import { t } from "@/lib/i18n";

export function SetTools({ setId }: { setId: string }) {
  return (
    <ListSection header={t("setDetail.toolsHeader")}>
      <ListNavRow
        href={`/app/sets/${setId}/add`}
        icon={Icons.create}
        label={t("setEditor.addWord")}
      />
      <ListNavRow
        href={`/app/sets/${setId}/supplement`}
        icon={Icons.ai}
        label={t("supplement.title")}
      />
      <ListNavRow
        href={`/app/sets/${setId}/settings`}
        icon={Icons.edit}
        label={t("wordEdit.metadata")}
      />
    </ListSection>
  );
}
