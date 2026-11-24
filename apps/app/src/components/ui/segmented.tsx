import { Host, Picker, Text as SwiftText } from "@expo/ui/swift-ui";
import { disabled as disabledModifier, frame, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { startTransition } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { haptics } from "@/lib/haptics";
import { colors, radius } from "@/lib/theme";
import { PressableScale } from "./pressable-scale";

/** The system's segmented control, for two to five short options. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const choose = (next: T) => {
    if (next === value) return;
    haptics.select();
    startTransition(() => onChange(next));
  };

  if (Platform.OS === "ios") {
    return (
      <Host style={styles.host} ignoreSafeArea="all">
        <Picker
          selection={String(value)}
          onSelectionChange={(next: string) => {
            const option = options.find((entry) => String(entry.value) === next);
            if (option) choose(option.value);
          }}
          modifiers={[
            pickerStyle("segmented"),
            frame({ maxWidth: 10_000, maxHeight: 10_000 }),
            disabledModifier(disabled),
          ]}
        >
          {options.map((option) => (
            <SwiftText key={String(option.value)} modifiers={[tag(String(option.value))]}>
              {option.label}
            </SwiftText>
          ))}
        </Picker>
      </Host>
    );
  }

  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={String(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => choose(option.value)}
            style={[styles.segment, selected && styles.segmentOn]}
          >
            <Text style={styles.label} numberOfLines={1}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { width: "100%", height: 36 },
  track: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderRadius: radius.pill,
  },
  segmentOn: { backgroundColor: colors.surface },
  label: { fontSize: 14, fontWeight: "500", color: colors.ink },
});
