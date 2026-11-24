import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { StyleSheet } from "react-native";

import { errorMessage } from "@/data/api";
import { starWords } from "@/data/library";
import { haptics } from "@/lib/haptics";
import { colors } from "@/lib/theme";
import { toast } from "@/platform/toast";
import { PressableScale } from "./pressable-scale";

/** Optimistic star button with native SF Symbol bounce + medium haptic feedback. */
export function StarButton({
  setId,
  wordId,
  starred,
  word,
  size = 20,
  onToggle,
}: {
  setId?: string;
  wordId?: string;
  starred: boolean;
  word: string;
  size?: number;
  /** Optional custom handler (used in practice rounds for words outside sets). */
  onToggle?: () => void;
}) {
  const [pulse, setPulse] = useState(0);

  const handlePress = () => {
    setPulse((n) => n + 1);
    haptics.confirm();
    if (onToggle) {
      onToggle();
      return;
    }
    if (!setId || !wordId) return;
    starWords(setId, [wordId], !starred).catch((reason) => {
      haptics.error();
      toast.error(errorMessage(reason));
    });
  };

  return (
    <PressableScale
      scaleTo={0.82}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={starred ? `取消標星 ${word}` : `標星 ${word}`}
      accessibilityState={{ selected: starred }}
      onPress={handlePress}
      style={styles.button}
    >
      <SymbolView
        key={pulse}
        name={starred ? "star.fill" : "star"}
        size={size}
        weight="semibold"
        tintColor={starred ? colors.highlight : colors.inkFaint}
        animationSpec={
          pulse > 0
            ? {
                effect: { type: "bounce", direction: "up" },
                repeating: false,
              }
            : undefined
        }
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
});
