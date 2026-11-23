import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type ColorValue } from "react-native";
import Animated from "react-native-reanimated";

import { Button } from "@/components/ui/button";
import { glide, pop, popOut } from "@/components/ui/motion";
import { PressableScale } from "@/components/ui/pressable-scale";
import { fade, Tone } from "@/components/ui/tone";
import { isRight, type Choice, type CustomStep } from "@/core/domain/custom";
import { haptics } from "@/lib/haptics";
import { colors, hasLatin, latin, radius } from "@/lib/theme";

type Mode<M extends CustomStep["mode"]> = Extract<CustomStep, { mode: M }>;

interface Props<M extends CustomStep["mode"]> {
  step: Mode<M>;
  chosen: Choice | null | undefined;
  revealed: boolean;
  submit: (choice: Choice) => void;
}

/** Native interactive answer widgets for 自由題型 modes (multiple, input, order, match). */
export function CustomAnswer(props: {
  step: Exclude<CustomStep, { mode: "single" }>;
  chosen: Choice | null | undefined;
  revealed: boolean;
  submit: (choice: Choice) => void;
}) {
  const { step, ...rest } = props;
  switch (step.mode) {
    case "multiple":
      return <Multiple step={step} {...rest} />;
    case "input":
      return <Typed step={step} {...rest} />;
    case "order":
      return <Order step={step} {...rest} />;
    case "match":
      return <Match step={step} {...rest} />;
  }
}

/** The states a bordered tile fades between. */
function TileTones({
  selected = false,
  right = false,
  wrong = false,
}: {
  selected?: boolean;
  right?: boolean;
  wrong?: boolean;
}) {
  return (
    <>
      <Tone on={selected} outset={1.5} style={[styles.tone, styles.tileSelected]} />
      <Tone on={right} outset={1.5} style={[styles.tone, styles.tileRight]} />
      <Tone on={wrong} outset={1.5} style={[styles.tone, styles.tileWrong]} />
    </>
  );
}

function Mark({ name, tint }: { name: "checkmark" | "xmark"; tint: ColorValue }) {
  return (
    <Animated.View entering={pop}>
      <SymbolView name={name} size={13} weight="bold" tintColor={tint} />
    </Animated.View>
  );
}

function Multiple({ step, chosen, revealed, submit }: Props<"multiple">) {
  const [picked, setPicked] = useState<number[]>([]);
  const shown = revealed && Array.isArray(chosen) ? chosen : picked;

  const toggle = (index: number) => {
    haptics.select();
    setPicked((current) =>
      current.includes(index) ? current.filter((v) => v !== index) : [...current, index],
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.list}>
        {step.options.map((option, index) => {
          const on = shown.includes(index);
          const right = revealed && step.answers.includes(index);
          const wrong = revealed && on && !right;
          return (
            <Animated.View
              key={index}
              style={[fade, { opacity: revealed && !right && !wrong ? 0.65 : 1 }]}
            >
              <PressableScale
                scaleTo={0.98}
                disabled={revealed}
                onPress={() => toggle(index)}
                style={styles.tile}
              >
                <TileTones selected={!revealed && on} right={right} wrong={wrong} />
                <View
                  style={[
                    styles.badge,
                    on && !revealed && styles.badgeSelected,
                    right && styles.badgeRight,
                    wrong && styles.badgeWrong,
                  ]}
                >
                  {right ? (
                    <Mark key="right" name="checkmark" tint={colors.positiveInk} />
                  ) : wrong ? (
                    <Mark key="wrong" name="xmark" tint={colors.dangerInk} />
                  ) : on ? (
                    <Mark key="on" name="checkmark" tint={colors.onContrast} />
                  ) : (
                    <Text style={styles.badgeNum}>{index + 1}</Text>
                  )}
                </View>
                <Text style={[styles.tileText, hasLatin(option) && latin.semibold]}>{option}</Text>
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
      {!revealed ? (
        <Button
          label="確認"
          icon="checkmark"
          size="lg"
          disabled={!picked.length}
          onPress={() => submit([...picked].sort((a, b) => a - b))}
        />
      ) : null}
    </View>
  );
}

function Typed({ step, chosen, revealed, submit }: Props<"input">) {
  const [text, setText] = useState("");
  const value = revealed ? (typeof chosen === "string" ? chosen : "") : text;
  const right = revealed && isRight(step, chosen);

  const send = () => {
    if (!text.trim() || revealed) return;
    submit(text);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.inputBox}>
        <TileTones right={right} wrong={revealed && !right} />
        <TextInput
          accessibilityLabel="你的答案"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          autoFocus={!revealed}
          editable={!revealed}
          value={value}
          onChangeText={setText}
          onSubmitEditing={send}
          returnKeyType="done"
          placeholder="輸入答案…"
          placeholderTextColor={colors.inkFaint}
          style={[styles.textInput, revealed && (right ? styles.textRight : styles.textWrong)]}
        />
      </View>
      {!revealed ? (
        <Button label="確認" icon="checkmark" size="lg" disabled={!text.trim()} onPress={send} />
      ) : null}
    </View>
  );
}

function Order({ step, chosen, revealed, submit }: Props<"order">) {
  const [placed, setPlaced] = useState<number[]>([]);
  const line = revealed && Array.isArray(chosen) ? chosen : placed;
  const left = step.pieces.map((_, index) => index).filter((index) => !line.includes(index));

  return (
    <View style={styles.wrap}>
      <Animated.View layout={glide} style={styles.tray}>
        {line.length === 0 ? (
          <Text style={styles.trayPlaceholder}>點擊下方片段依序排列</Text>
        ) : (
          line.map((index, at) => {
            const right = revealed && step.order[at] === index;
            return (
              <Animated.View key={index} layout={glide} entering={pop} exiting={popOut}>
                <PressableScale
                  scaleTo={0.94}
                  disabled={revealed}
                  onPress={() => {
                    haptics.select();
                    setPlaced((current) => current.filter((v) => v !== index));
                  }}
                  style={styles.chip}
                >
                  <Tone
                    on={!revealed}
                    outset={1.5}
                    style={[styles.chipTone, styles.tileSelected]}
                  />
                  <Tone
                    on={revealed && right}
                    outset={1.5}
                    style={[styles.chipTone, styles.tileRight]}
                  />
                  <Tone
                    on={revealed && !right}
                    outset={1.5}
                    style={[styles.chipTone, styles.tileWrong]}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      revealed && (right ? styles.textRight : styles.textWrong),
                    ]}
                  >
                    {step.pieces[index]}
                  </Text>
                </PressableScale>
              </Animated.View>
            );
          })
        )}
      </Animated.View>

      {!revealed ? (
        <>
          <Animated.View layout={glide} style={styles.pool}>
            {left.map((index) => (
              <Animated.View key={index} layout={glide} entering={pop} exiting={popOut}>
                <PressableScale
                  scaleTo={0.94}
                  onPress={() => {
                    haptics.select();
                    setPlaced((current) => [...current, index]);
                  }}
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>{step.pieces[index]}</Text>
                </PressableScale>
              </Animated.View>
            ))}
          </Animated.View>
          <Button
            label="確認"
            icon="checkmark"
            size="lg"
            disabled={left.length > 0}
            onPress={() => submit(placed)}
          />
        </>
      ) : null}
    </View>
  );
}

function Match({ step, chosen, revealed, submit }: Props<"match">) {
  const [pairs, setPairs] = useState<number[]>(() => step.left.map(() => -1));
  const [active, setActive] = useState(0);
  const shown = revealed && Array.isArray(chosen) ? chosen : pairs;

  const pickRight = (right: number) => {
    haptics.select();
    const next = pairs.map((value, index) =>
      index === active ? right : value === right ? -1 : value,
    );
    setPairs(next);
    const open = next.findIndex((value) => value === -1);
    if (open !== -1) setActive(open);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.matchGrid}>
        <View style={styles.matchCol}>
          {step.left.map((text, index) => {
            const right = revealed && shown[index] === step.match[index];
            const isActive = !revealed && active === index;
            return (
              <PressableScale
                key={index}
                scaleTo={0.97}
                disabled={revealed}
                onPress={() => {
                  haptics.select();
                  setActive(index);
                }}
                style={styles.matchTile}
              >
                <TileTones selected={isActive} right={right} wrong={revealed && !right} />
                <View style={styles.matchNum}>
                  <Text style={styles.matchNumText}>{index + 1}</Text>
                </View>
                <Text style={[styles.matchLabel, hasLatin(text) && latin.semibold]}>{text}</Text>
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.matchCol}>
          {step.right.map((text, index) => {
            const owner = shown.indexOf(index);
            return (
              <Animated.View key={index} style={[fade, { opacity: revealed ? 0.65 : 1 }]}>
                <PressableScale
                  scaleTo={0.97}
                  disabled={revealed}
                  onPress={() => pickRight(index)}
                  style={styles.matchTile}
                >
                  <Tone
                    on={owner !== -1}
                    outset={1.5}
                    style={[styles.tone, styles.matchAssigned]}
                  />
                  <Text style={[styles.matchLabel, hasLatin(text) && latin.semibold]}>{text}</Text>
                  {owner !== -1 ? (
                    <Animated.View entering={pop} exiting={popOut} style={styles.ownerBadge}>
                      <Text style={styles.ownerText}>{owner + 1}</Text>
                    </Animated.View>
                  ) : null}
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>
      </View>

      {!revealed ? (
        <Button
          label="確認"
          icon="checkmark"
          size="lg"
          disabled={pairs.includes(-1)}
          onPress={() => submit(pairs)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  list: { gap: 8 },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  tone: { borderRadius: radius.tile, borderWidth: 1.5 },
  tileSelected: {
    borderColor: colors.contrast,
    backgroundColor: colors.accentSoft,
  },
  tileRight: {
    borderColor: colors.positive,
    backgroundColor: colors.positiveSoft,
  },
  tileWrong: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeSelected: { backgroundColor: colors.contrast },
  badgeRight: { backgroundColor: "transparent" },
  badgeWrong: { backgroundColor: "transparent" },
  badgeNum: { ...latin.semibold, fontSize: 13, color: colors.inkMuted },
  tileText: { fontSize: 16, color: colors.ink, flex: 1 },
  inputBox: {
    borderRadius: radius.tile,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  textInput: {
    ...latin.semibold,
    minHeight: 51,
    paddingHorizontal: 16,
    fontSize: 18,
    color: colors.ink,
  },
  tray: {
    minHeight: 68,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.line,
    padding: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  trayPlaceholder: { fontSize: 14, color: colors.inkFaint, paddingHorizontal: 4 },
  pool: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radius.chip,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipTone: { borderRadius: radius.chip, borderWidth: 1.5 },
  chipText: { ...latin.semibold, fontSize: 15, color: colors.ink },
  textRight: { color: colors.positiveInk },
  textWrong: { color: colors.dangerInk },
  matchGrid: { flexDirection: "row", gap: 8 },
  matchCol: { flex: 1, gap: 8 },
  matchTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  matchAssigned: {
    borderColor: colors.contrast,
    backgroundColor: colors.surfaceRaised,
  },
  matchNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  matchNumText: { ...latin.semibold, fontSize: 12, color: colors.inkMuted },
  matchLabel: { fontSize: 14, color: colors.ink, flex: 1 },
  ownerBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.contrast,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerText: { ...latin.bold, fontSize: 12, color: colors.onContrast },
});
