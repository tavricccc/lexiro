import {
  Button as SwiftButton,
  GlassEffectContainer,
  HStack,
  Host,
  Image,
  Namespace,
  Text as SwiftText,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  animation,
  Animation,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  glassEffectId,
  lineLimit,
  minimumScaleFactor,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useFocusEffect } from "expo-router";
import { useCallback, useId, useState } from "react";
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { haptics } from "@/lib/haptics";
import { Button, fills, heights, surface, type ButtonProps, type ButtonSize } from "./button";
import { DURATION } from "./motion";

export type DockAction = Pick<
  ButtonProps,
  "label" | "icon" | "variant" | "disabled" | "haptic" | "onPress"
> & {
  id: string;
  /** Which piece of glass this is: an action taking over another's shape names the same one. */
  shape: string;
};

const GAP = 8;
/** Glass closer than this melts together, so it stays under the gap: apart at rest. */
const MELT = GAP / 2;

/**
 * A row of buttons whose glass flows from one set into the next: one button
 * splits into several, several run back together. `expanded` says which set
 * is shown; the change of it is what animates.
 */
export function GlassDock({
  actions,
  expanded,
  size = "lg",
  fill = true,
  style,
}: {
  actions: DockAction[];
  expanded: boolean;
  size?: ButtonSize;
  /** Buttons share the width; otherwise they keep their own and sit at the end. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const base = useId();
  const [visit, setVisit] = useState(0);
  const { fontScale } = useWindowDimensions();
  // The native namespace unregisters when the page is covered; a new id registers it again.
  useFocusEffect(useCallback(() => () => setVisit((count) => count + 1), []));

  if (Platform.OS !== "ios") {
    return (
      <View style={[styles.row, !fill && styles.end, style]}>
        {actions.map(({ id, label, icon, variant, disabled, haptic, onPress }) => (
          <Button
            key={id}
            label={label}
            icon={icon}
            variant={variant}
            disabled={disabled}
            haptic={haptic}
            onPress={onPress}
            size={size}
            style={fill && styles.share}
          />
        ))}
      </View>
    );
  }

  const namespace = `${base}${visit}`;
  const dims = heights[size];
  const flow = animation(Animation.spring({ duration: DURATION.morph / 1000, bounce: 0.2 }), expanded);

  return (
    <Host style={[{ height: dims.minHeight * Math.max(1, fontScale) }, style]} ignoreSafeArea="all">
      <Namespace id={namespace}>
        <GlassEffectContainer spacing={MELT} modifiers={[flow]}>
          <HStack
            spacing={GAP}
            modifiers={[
              frame({
                maxWidth: 10_000,
                maxHeight: 10_000,
                alignment: fill ? "center" : "trailing",
              }),
              flow,
            ]}
          >
            {actions.map((action) => {
              const look = fills[action.variant ?? "primary"];
              return (
                <SwiftButton
                  key={action.id}
                  onPress={() => {
                    if (action.haptic === "confirm") haptics.confirm();
                    else if (action.haptic !== "none") haptics.select();
                    action.onPress?.();
                  }}
                  modifiers={[
                    buttonStyle(surface(look.prominent)),
                    buttonBorderShape("capsule"),
                    controlSize("regular"),
                    tint(look.tint),
                    accessibilityLabel(action.label),
                    disabledModifier(!!action.disabled),
                    glassEffectId(action.shape, namespace),
                  ]}
                >
                  <HStack
                    spacing={7}
                    modifiers={[
                      frame({ maxWidth: fill ? 10_000 : undefined, maxHeight: 10_000 }),
                      font({ size: dims.fontSize * fontScale, weight: "semibold" }),
                      ...(action.disabled ? [] : [foregroundStyle(look.text)]),
                    ]}
                  >
                    {action.icon ? (
                      <Image systemName={action.icon as never} size={dims.icon * fontScale} />
                    ) : null}
                    <SwiftText modifiers={[lineLimit(1), minimumScaleFactor(0.8)]}>
                      {action.label}
                    </SwiftText>
                  </HStack>
                </SwiftButton>
              );
            })}
          </HStack>
        </GlassEffectContainer>
      </Namespace>
    </Host>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: GAP },
  end: { justifyContent: "flex-end" },
  share: { flex: 1 },
});
