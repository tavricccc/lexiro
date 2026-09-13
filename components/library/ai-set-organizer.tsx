"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { InputOrganizer } from "@/components/library/input-organizer";
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
  return (
    <StepFrame
      back={<BackControl href="/sets/new" label={t("setEditor.cancel")} />}
      current={1}
      title={t("setEditor.aiAssist")}
      total={2}
      width="wide"
    >
      <Field label={t("setEditor.name")}>
        <Input
          onChange={(event) => setName(event.target.value)}
          placeholder={t("setEditor.namePlaceholder")}
          value={name}
        />
      </Field>
      <div className="section-gap">
        <InputOrganizer
          disabled={false}
          onConfirm={(sources) => {
            writeAiSetDraft({ name, sources });
            router.push("/sets/new/generate");
          }}
          onInvalidate={() => undefined}
        />
      </div>
    </StepFrame>
  );
}
