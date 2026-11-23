import {
  Button as SwiftButton,
  Divider,
  HStack,
  Host,
  Menu,
  Picker,
  Spacer,
  Text as SwiftText,
  Toggle,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  contentShape,
  frame,
  menuActionDismissBehavior,
  pickerStyle,
  shapes,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { Children, Fragment, isValidElement, type ComponentProps, type ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ColorValue,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";

import { haptics } from "@/lib/haptics";
import { PINE_LIGHT, colors, radius, space, type } from "@/lib/theme";
import { pop, popOut } from "./motion";
import { PressableRow } from "./pressable-row";
import { PressableScale } from "./pressable-scale";

const ICON_INSET = space.row + 24 + 14;

/** iOS inset grouped card list with hairline separators. */
export function ListGroup({
  title,
  aside,
  footer,
  children,
  iconInset = false,
  style,
}: {
  title?: string;
  aside?: ReactNode;
  footer?: string;
  children: ReactNode;
  iconInset?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.group, style]}>
      {title || aside ? (
        <View style={styles.groupHeader}>
          {title ? <Text style={styles.groupTitle}>{title}</Text> : <View />}
          {aside}
        </View>
      ) : null}
      <View style={styles.card}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index ? (
              <View
                style={[
                  styles.separator,
                  { marginLeft: iconInset ? ICON_INSET : space.row },
                ]}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  detail,
  icon,
  iconTint,
  leading,
  chevron,
  accessory,
  destructive,
  disabled,
  latinTitle = false,
  onPress,
}: {
  title: string;
  subtitle?: string;
  detail?: string;
  icon?: SymbolViewProps["name"];
  iconTint?: ColorValue;
  leading?: ReactNode;
  chevron?: boolean;
  accessory?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  latinTitle?: boolean;
  onPress?: () => void;
}) {
  return (
    <PressableRow
      accessibilityRole={onPress ? "button" : undefined}
      onPress={
        onPress
          ? () => {
              haptics.select();
              onPress();
            }
          : undefined
      }
      disabled={!onPress || disabled}
      style={[styles.row, disabled && styles.disabled]}
    >
      {leading}
      {icon ? (
        <SymbolView
          name={icon}
          size={21}
          weight="medium"
          tintColor={destructive ? colors.danger : (iconTint ?? colors.ink)}
          style={styles.icon}
        />
      ) : null}
      <View style={styles.rowText}>
        <Text
          style={[
            styles.title,
            latinTitle && { fontFamily: "AlbertSans-600" },
            destructive && { color: colors.danger },
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {detail ? (
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
      {accessory}
      {chevron ? (
        <SymbolView
          name="chevron.right"
          size={13}
          weight="semibold"
          tintColor={colors.inkFaint}
        />
      ) : null}
    </PressableRow>
  );
}

export function CheckRow({
  title,
  subtitle,
  icon,
  leading,
  detail,
  checked,
  disabled,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: SymbolViewProps["name"];
  leading?: ReactNode;
  detail?: string;
  checked: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      icon={icon}
      leading={leading}
      detail={detail}
      disabled={disabled}
      onPress={onPress}
      accessory={
        <View style={[styles.checkCircle, checked && styles.checkCircleOn]}>
          {checked ? (
            <Animated.View entering={pop} exiting={popOut}>
              <SymbolView
                name="checkmark"
                size={12}
                weight="bold"
                tintColor={colors.onContrast}
              />
            </Animated.View>
          ) : null}
        </View>
      }
    />
  );
}

export function SwitchRow({
  title,
  subtitle,
  icon,
  value,
  disabled,
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  icon?: SymbolViewProps["name"];
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      icon={icon}
      accessory={
        <Switch
          value={value}
          disabled={disabled}
          onValueChange={(next) => {
            haptics.select();
            onValueChange(next);
          }}
          trackColor={{ true: PINE_LIGHT }}
        />
      }
    />
  );
}

export function InputRow({
  label,
  value,
  onChangeText,
  placeholder,
  invalid,
  autoFocus,
  editable = true,
  autoCapitalize = "none",
  latinValue = false,
  maxLength,
  returnKeyType,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  latinValue?: boolean;
  maxLength?: number;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.inputLabel, invalid && { color: colors.danger }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        autoFocus={autoFocus}
        editable={editable}
        maxLength={maxLength}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        returnKeyType={returnKeyType}
        style={[styles.input, latinValue && { fontFamily: "AlbertSans-600" }]}
        value={value}
      />
    </View>
  );
}

export function TextBlockRow({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  onRemove,
  removeLabel,
  editable = true,
  latinValue = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  onRemove?: () => void;
  removeLabel?: string;
  editable?: boolean;
  latinValue?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Text style={styles.blockLabel}>{label}</Text>
        {onRemove ? (
          <PressableScale
            scaleTo={0.85}
            accessibilityRole="button"
            accessibilityLabel={removeLabel}
            hitSlop={10}
            onPress={() => {
              haptics.select();
              onRemove();
            }}
          >
            <SymbolView name="minus.circle.fill" size={20} tintColor={colors.danger} />
          </PressableScale>
        ) : null}
      </View>
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        editable={editable}
        maxLength={maxLength}
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        scrollEnabled={false}
        style={[styles.blockInput, latinValue && { fontFamily: "AlbertSans-500" }]}
        value={value}
      />
      {hint ? <Text style={styles.blockHint}>{hint}</Text> : null}
    </View>
  );
}

export function ActionRow({
  title,
  icon,
  destructive,
  disabled,
  onPress,
}: {
  title: string;
  icon?: SymbolViewProps["name"];
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const tint = destructive ? colors.danger : colors.ink;
  return (
    <PressableRow
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        if (destructive) haptics.warning();
        else haptics.tap();
        onPress();
      }}
      style={[styles.row, disabled && styles.disabled]}
    >
      <SymbolView
        name={icon ?? (destructive ? "trash" : "plus.circle")}
        size={20}
        weight="medium"
        tintColor={tint}
        style={styles.icon}
      />
      <Text style={[styles.title, { color: tint }]}>{title}</Text>
    </PressableRow>
  );
}

function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  if (Platform.OS !== "ios") return null;
  return (
    <Host style={StyleSheet.absoluteFill}>
      <Menu
        label={
          <HStack
            modifiers={[
              frame({ maxWidth: 10_000, maxHeight: 10_000 }),
              contentShape(shapes.rectangle()),
            ]}
          >
            <Spacer />
          </HStack>
        }
        modifiers={[accessibilityLabel(label)]}
      >
        {children}
      </Menu>
    </Host>
  );
}

const menuChevron = (
  <SymbolView
    name="chevron.up.chevron.down"
    size={13}
    weight="semibold"
    tintColor={colors.inkFaint}
  />
);

/** Native iOS SwiftUI inline Menu Picker anchored directly to the row. */
export function PickerRow<T extends string>({
  title,
  icon,
  value,
  options,
  onChange,
  disabled,
}: {
  title: string;
  icon?: SymbolViewProps["name"];
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const current = options.find((option) => option.value === value);
  return (
    <View style={disabled && styles.disabled}>
      <ListRow
        title={title}
        icon={icon}
        detail={current?.label}
        accessory={menuChevron}
      />
      {disabled ? null : (
        <RowMenu label={title}>
          <Picker
            selection={value}
            onSelectionChange={(next: T) => {
              haptics.select();
              onChange(next);
            }}
            modifiers={[pickerStyle("inline")]}
          >
            {options.map((option) => (
              <SwiftText key={option.value} modifiers={[tag(option.value)]}>
                {option.label}
              </SwiftText>
            ))}
          </Picker>
        </RowMenu>
      )}
    </View>
  );
}

/** Native iOS SwiftUI multi-select menu anchored to a row. */
export function MultiPickerRow({
  title,
  icon,
  allLabel,
  summary,
  value,
  options,
  onChange,
}: {
  title: string;
  icon?: SymbolViewProps["name"];
  allLabel: string;
  summary: string;
  value: readonly string[];
  options: readonly { value: string; label: string }[];
  onChange: (value: string[]) => void;
}) {
  return (
    <View>
      <ListRow title={title} icon={icon} detail={summary} accessory={menuChevron} />
      <RowMenu label={title}>
        <Toggle
          label={allLabel}
          isOn={!value.length}
          onIsOnChange={() => {
            haptics.select();
            onChange([]);
          }}
        />
        <Divider />
        {options.map((option) => (
          <Toggle
            key={option.value}
            label={option.label}
            isOn={value.includes(option.value)}
            onIsOnChange={(on) => {
              haptics.select();
              onChange(
                options
                  .map((entry) => entry.value)
                  .filter((entry) => (entry === option.value ? on : value.includes(entry))),
              );
            }}
            modifiers={[menuActionDismissBehavior("disabled")]}
          />
        ))}
      </RowMenu>
    </View>
  );
}

export interface NativeMenuItem {
  key: string;
  label: string;
  systemImage?: ComponentProps<typeof SwiftButton>["systemImage"];
  role?: "default" | "destructive";
  onPress: () => void;
}

/**
 * Wraps any trigger element in an invisible SwiftUI Menu overlay so tapping it
 * unfolds a true native iOS pull-down menu from the exact touch origin.
 */
export function NativeMenuTrigger({
  label,
  items,
  children,
  style,
}: {
  label: string;
  items: NativeMenuItem[];
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  if (Platform.OS !== "ios") {
    return <View style={style}>{children}</View>;
  }
  return (
    <View style={style}>
      {children}
      <Host style={StyleSheet.absoluteFill}>
        <Menu
          label={
            <HStack
              modifiers={[
                frame({ maxWidth: 10_000, maxHeight: 10_000 }),
                contentShape(shapes.rectangle()),
              ]}
            >
              <Spacer />
            </HStack>
          }
          modifiers={[accessibilityLabel(label)]}
        >
          {items.map((item) => (
            <SwiftButton
              key={item.key}
              label={item.label}
              systemImage={item.systemImage}
              role={item.role === "destructive" ? "destructive" : undefined}
              onPress={() => {
                if (item.role === "destructive") haptics.warning();
                else haptics.select();
                item.onPress();
              }}
            />
          ))}
        </Menu>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  groupTitle: {
    ...type.hint,
    fontWeight: "600",
    color: colors.inkMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  footer: {
    ...type.hint,
    color: colors.inkMuted,
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: space.row,
    paddingVertical: 11,
  },
  icon: { width: 24, height: 24 },
  rowText: { flex: 1, gap: 2 },
  title: { ...type.row, color: colors.ink },
  subtitle: { ...type.hint, color: colors.inkMuted },
  detail: {
    flexShrink: 1,
    maxWidth: "50%",
    fontSize: 15,
    color: colors.inkMuted,
    fontVariant: ["tabular-nums"],
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.inkFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleOn: {
    borderColor: colors.contrast,
    backgroundColor: colors.contrast,
  },
  disabled: { opacity: 0.45 },
  inputLabel: { ...type.row, color: colors.ink, width: 88 },
  input: {
    ...type.row,
    flex: 1,
    color: colors.ink,
    textAlign: "right",
    paddingVertical: 4,
  },
  block: { gap: 6, paddingHorizontal: space.row, paddingVertical: 12 },
  blockHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  blockLabel: { ...type.hint, fontWeight: "600", color: colors.inkMuted },
  blockInput: {
    ...type.body,
    color: colors.ink,
    minHeight: 28,
    paddingVertical: 2,
  },
  blockHint: {
    ...type.hint,
    fontSize: 12,
    color: colors.inkFaint,
  },
});
