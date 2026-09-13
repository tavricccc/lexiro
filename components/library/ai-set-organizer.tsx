"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  InputOrganizer,
  type OrganizerPhase,
} from "@/components/library/input-organizer";
import { BackControl } from "@/components/ui/back-control";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { StepFrame } from "@/components/ui/step-frame";
import { t } from "@/lib/i18n";
import { writeAiSetDraft } from "@/lib/ai-set-draft";

/** First AI capture page: name the set and confirm a cleaned source list. */
export function AiSetOrganizer() {
  const router = useRouter();
  const [name, setName] = useState(t("setEditor.defaultSetName"));
  const [phase, setPhase] = useState<OrganizerPhase>("input");
  const reviewing = phase === "review";
  return (
    <StepFrame
      {...(reviewing
        ? { onBack: () => setPhase("input") }
        : {
            back: (
              <BackControl href="/sets/new" label={t("setEditor.cancel")} />
            ),
          })}
      current={reviewing ? 2 : 1}
      title={t(reviewing ? "setEditor.aiListTitle" : "setEditor.aiAssist")}
      total={4}
      width="wide"
    >
      {!reviewing && (
        <Field label={t("setEditor.name")}>
          <Input
            onChange={(event) => setName(event.target.value)}
            placeholder={t("setEditor.namePlaceholder")}
            value={name}
          />
        </Field>
      )}
      <div className={reviewing ? undefined : "section-gap"}>
        <InputOrganizer
          onConfirm={(sources) => {
            writeAiSetDraft({ name, sources });
            router.push("/sets/new/generate");
          }}
          onPhase={setPhase}
          phase={phase}
        />
      </div>
    </StepFrame>
  );
}
