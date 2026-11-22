import { SymbolView } from "expo-symbols";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";

import { useOnline } from "@/data/network";
import { colors, radius, type } from "@/lib/theme";

/** Shown immediately when expo-network reports offline; disappears automatically on reconnect. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      style={styles.banner}
      accessibilityRole="alert"
    >
      <SymbolView name="wifi.slash" size={16} weight="semibold" tintColor={colors.caution} />
      <Text style={styles.text}>目前離線：可以瀏覽和練習，作答會在連線後自動上傳。</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    backgroundColor: colors.cautionSoft,
  },
  text: {
    ...type.hint,
    color: colors.caution,
    fontWeight: "600",
    flex: 1,
  },
});
