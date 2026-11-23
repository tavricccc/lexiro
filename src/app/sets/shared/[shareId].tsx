import { useLocalSearchParams } from "expo-router";

import { SharedSet } from "@/components/library/shared-set";
import { Screen } from "@/components/ui/layout";
import { SheetHeader } from "@/components/ui/sheet-header";
import { parseShareCode } from "@/core/contract";

/** A share link opened from outside the app. */
export default function SharedSetScreen() {
  const { shareId = "" } = useLocalSearchParams<{ shareId: string }>();
  return (
    <>
      <SheetHeader title="分享的單字集" />
      <Screen>
        <SharedSet code={parseShareCode(shareId) ?? shareId} />
      </Screen>
    </>
  );
}
