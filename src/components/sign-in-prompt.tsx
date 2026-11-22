import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/api";
import { SignInCancelled, signIn } from "@/data/auth";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, space, type } from "@/lib/theme";
import { isFirebaseConfigured } from "@/platform/firebase-config";

export function SignInPrompt() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const configured = isFirebaseConfigured();

  const handleSignIn = async () => {
    setBusy(true);
    setError("");
    try {
      await signIn();
      haptics.success();
    } catch (reason) {
      if (!(reason instanceof SignInCancelled)) {
        haptics.error();
        setError(errorMessage(reason));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <View style={styles.brandBadge}>
          <SymbolView name="books.vertical.fill" size={32} weight="medium" tintColor={colors.onContrast} />
        </View>
        <Text style={styles.brandName}>Lexiro</Text>

        <View style={styles.copy}>
          <Text style={styles.title}>用自己的單字集練英文</Text>
          <Text style={styles.body}>
            登入後，單字集、題目和練習紀錄會跟著帳號，在每台裝置都一樣。
          </Text>
        </View>

        <Button
          label="使用 Google 登入"
          icon="person.badge.key.fill"
          size="lg"
          variant="primary"
          busy={busy}
          disabled={!configured}
          haptic="confirm"
          onPress={() => void handleSignIn()}
          style={styles.button}
        />

        {!configured ? (
          <Text style={styles.hint}>這個版本尚未設定登入服務。</Text>
        ) : null}
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: "center",
    paddingHorizontal: space.gutter * 1.5,
  },
  center: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    alignItems: "center",
    gap: 16,
  },
  brandBadge: {
    width: 68,
    height: 68,
    borderRadius: radius.card,
    borderCurve: "continuous",
    backgroundColor: colors.contrast,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  brandName: {
    ...latin.heavy,
    fontSize: 30,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  copy: {
    alignItems: "center",
    gap: 8,
    marginVertical: 8,
  },
  title: {
    ...type.title,
    color: colors.ink,
    textAlign: "center",
  },
  body: {
    ...type.body,
    color: colors.inkMuted,
    textAlign: "center",
  },
  button: {
    width: "100%",
    marginTop: 8,
  },
  hint: {
    ...type.hint,
    color: colors.inkFaint,
    textAlign: "center",
  },
  error: {
    ...type.hint,
    color: colors.dangerInk,
    textAlign: "center",
  },
});
