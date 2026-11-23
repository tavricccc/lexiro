import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";

import { SharedSet } from "@/components/library/shared-set";
import { KeyboardScreen } from "@/components/ui/layout";
import { SheetHeader } from "@/components/ui/sheet-header";
import { SHARE_CODE_LENGTH, parseShareCode } from "@/core/contract";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, type } from "@/lib/theme";

/** Finds a shared set by its code or a pasted link, and shows it below the field. */
export default function JoinScreen() {
  const { folder } = useLocalSearchParams<{ folder?: string }>();
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const code = parseShareCode(text);

  return (
    <>
      <SheetHeader title="用代碼加入" />
      <KeyboardScreen>
        <TextInput
          accessibilityLabel="分享代碼"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect={false}
          autoFocus
          onChangeText={(next) => {
            // A pasted link becomes its code.
            const found = parseShareCode(next);
            setText(found ?? next);
            setError(false);
            if (found && found !== code) haptics.select();
          }}
          onSubmitEditing={() => {
            if (code) return;
            haptics.error();
            setError(true);
          }}
          placeholder="ABCD2345"
          placeholderTextColor={colors.inkFaint}
          returnKeyType="search"
          spellCheck={false}
          style={[styles.input, text.length > SHARE_CODE_LENGTH + 2 && styles.long]}
          value={text}
        />
        {code ? (
          <SharedSet key={code} code={code} folderId={folder} />
        ) : (
          <Text style={[styles.hint, error && styles.error]}>
            輸入 {SHARE_CODE_LENGTH} 個英數字的代碼，或貼上分享連結。
          </Text>
        )}
      </KeyboardScreen>
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    ...latin.bold,
    minHeight: 60,
    borderRadius: radius.card,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    fontSize: 24,
    letterSpacing: 5,
    textAlign: "center",
    color: colors.ink,
  },
  long: { fontSize: 14, letterSpacing: 0 },
  hint: { ...type.hint, color: colors.inkMuted, textAlign: "center" },
  error: { color: colors.dangerInk },
});
