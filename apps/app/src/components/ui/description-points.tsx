import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { descriptionPoints } from "@/core/contract";
import { colors, radius, type } from "@/lib/theme";

/** Renders a sense's newline-separated description as clean bulleted points. */
export function DescriptionPoints({
  description,
  points: explicitPoints,
  boxed = false,
  compact = false,
  style,
}: {
  description?: string;
  points?: string[];
  boxed?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const items = explicitPoints ?? descriptionPoints(description);
  if (!items.length) return null;

  return (
    <View style={[styles.list, boxed && styles.boxed, style]}>
      {items.map((point, index) => (
        <View key={index} style={styles.row}>
          <Text style={[styles.bullet, compact && styles.compactText]} aria-hidden>
            •
          </Text>
          <Text style={[styles.text, compact && styles.compactText]}>{point}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 4,
  },
  boxed: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    backgroundColor: colors.surfaceRaised,
  },
  row: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
  },
  bullet: {
    ...type.body,
    color: colors.inkFaint,
  },
  text: {
    ...type.body,
    color: colors.inkMuted,
    flex: 1,
  },
  compactText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
