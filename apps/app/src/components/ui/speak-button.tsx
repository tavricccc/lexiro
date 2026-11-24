import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { StyleSheet } from "react-native";

import { haptics } from "@/lib/haptics";
import { speak } from "@/lib/speech";
import { colors } from "@/lib/theme";
import { IconButton } from "./button";
import { PressableScale } from "./pressable-scale";

/** Manual English pronunciation button; never plays automatically, works on silent switch. */
export function SpeakButton({
  text,
  size = 19,
  compact = false,
}: {
  text: string;
  size?: number;
  compact?: boolean;
}) {
  const [pulse, setPulse] = useState(0);

  if (!compact) {
    return (
      <IconButton
        label={`朗讀 ${text}`}
        icon="speaker.wave.2.fill"
        onPress={() => speak(text)}
      />
    );
  }

  return (
    <PressableScale
      scaleTo={0.85}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`朗讀 ${text}`}
      onPress={() => {
        setPulse((n) => n + 1);
        haptics.tap();
        speak(text);
      }}
      style={styles.compact}
    >
      <SymbolView
        key={pulse}
        name="speaker.wave.2.fill"
        size={size}
        weight="medium"
        tintColor={colors.inkMuted}
        animationSpec={
          pulse > 0
            ? {
                effect: { type: "bounce" },
                repeating: false,
              }
            : undefined
        }
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  compact: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
});
