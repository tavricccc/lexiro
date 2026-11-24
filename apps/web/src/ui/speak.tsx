import { SpeakerHigh } from "@phosphor-icons/react";
import { Button, Tooltip } from "design-kit";

/** Reads English aloud. Speech only ever starts from this button. */
export function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  speechSynthesis.speak(utterance);
}

export function SpeakButton({ text, size = "icon-sm" }: { text: string; size?: "icon" | "icon-sm" }) {
  if (typeof window !== "undefined" && !("speechSynthesis" in window)) return null;
  return (
    <Tooltip label="朗讀">
      <Button aria-label={`朗讀 ${text}`} onClick={() => speak(text)} size={size} variant="ghost">
        <SpeakerHigh weight="bold" />
      </Button>
    </Tooltip>
  );
}
