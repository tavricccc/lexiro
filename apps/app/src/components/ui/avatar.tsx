import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { colors, latin } from "@/lib/theme";

export function Avatar({
  name,
  uri,
  size = 52,
}: {
  name: string;
  uri?: string | null;
  size?: number;
}) {
  const initial = (name.trim()[0] || "?").toUpperCase();
  const radius = size / 2;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.surfaceRaised }}
        contentFit="cover"
        transition={200}
      />
    );
  }
  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      <Text style={[styles.initial, { fontSize: Math.round(size * 0.42) }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    ...latin.bold,
    color: colors.accentInk,
  },
});
