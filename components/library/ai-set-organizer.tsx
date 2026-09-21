"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  InputOrganizer,
  type OrganizerPhase,
} from "@/components/library/input-organizer";
import { SetFolderPicker } from "@/components/library/set-folder-picker";
import { BackControl } from "@/components/ui/back-control";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { StepFrame } from "@/components/ui/step-frame";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { writeAiSetDraft } from "@/lib/ai-set-draft";

/** First AI capture page: name the set and confirm a cleaned source list. */
export function AiSetOrganizer({
  initialFolderId,
}: {
  initialFolderId?: string;
}) {
  const router = useRouter();
  const folders = useLibraryStore((store) => store.state.folders);
  const [name, setName] = useState(t("setEditor.defaultSetName"));
  const [folderId, setFolderId] = useState(
    initialFolderId ?? UNCATEGORIZED_FOLDER_ID,
  );
  const [phase, setPhase] = useState<OrganizerPhase>("input");
  const reviewing = phase === "review";
  const newSetHref = initialFolderId
    ? `/sets/new?folderId=${encodeURIComponent(initialFolderId)}`
    : "/sets/new";
  return (
    <StepFrame
      {...(reviewing
        ? { onBack: () => setPhase("input") }
        : {
            back: (
              <BackControl href={newSetHref} label={t("setEditor.cancel")} />
            ),
          })}
      current={reviewing ? 2 : 1}
      title={t(reviewing ? "setEditor.aiListTitle" : "setEditor.aiAssist")}
      total={4}
      width="wide"
    >
      {!reviewing && (
        <div className="space-y-4">
          <Field label={t("setEditor.name")}>
            <Input
              onChange={(event) => setName(event.target.value)}
              placeholder={t("setEditor.namePlaceholder")}
              value={name}
            />
          </Field>
          <SetFolderPicker
            folders={folders}
            onChange={setFolderId}
            value={folderId}
          />
        </div>
      )}
      <div className={reviewing ? undefined : "section-gap"}>
        <InputOrganizer
          onConfirm={(sources) => {
            writeAiSetDraft({ folderId, name, sources });
            router.push("/sets/new/generate");
          }}
          onPhase={setPhase}
          phase={phase}
        />
      </div>
    </StepFrame>
  );
}
