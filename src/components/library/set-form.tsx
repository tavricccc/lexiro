import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";

import { InputRow, ListGroup, PickerRow } from "@/components/ui/list";
import { PressableScale } from "@/components/ui/pressable-scale";
import { SET_ICON_LABELS, SET_ICON_SYMBOLS, SetIcon } from "@/components/ui/set-icon";
import { SET_ICONS, type Folder, type SetHue, type SetIcon as SetIconName } from "@/core/contract";
import { folderTree } from "@/lib/folders";
import { haptics } from "@/lib/haptics";
import { colors, radius, type } from "@/lib/theme";

export interface SetFormValue {
  name: string;
  folderId: string | null;
  hue: SetHue;
  icon: SetIconName;
}

export function SetForm({
  value,
  onChange,
  folders,
  error,
}: {
  value: SetFormValue;
  onChange: (next: SetFormValue) => void;
  folders: Folder[];
  error?: string;
}) {
  const tree = folderTree(folders);
  return (
    <View style={styles.form}>
      <View style={styles.previewRow}>
        <SetIcon icon={value.icon} size={58} />
        <View style={styles.previewText}>
          <Text style={styles.previewTitle} numberOfLines={1}>
            {value.name.trim() || "未命名單字集"}
          </Text>
          <Text style={styles.previewSub}>{SET_ICON_LABELS[value.icon]}</Text>
        </View>
      </View>

      <ListGroup title="基本資訊">
        <InputRow
          label="名稱"
          value={value.name}
          onChangeText={(name) => onChange({ ...value, name })}
          placeholder="例如：第三課、多益 600"
          maxLength={200}
          invalid={Boolean(error)}
          autoFocus={!value.name}
        />
        {folders.length > 0 ? (
          <PickerRow
            title="資料夾"
            icon="folder"
            value={value.folderId ?? "none"}
            options={[
              { value: "none", label: "不放資料夾" },
              ...tree.flat.map(({ folder }) => ({ value: folder.id, label: tree.path(folder.id) })),
            ]}
            onChange={(next) =>
              onChange({ ...value, folderId: next === "none" ? null : next })
            }
          />
        ) : null}
      </ListGroup>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View style={styles.iconSection}>
        <Text style={styles.sectionLabel}>圖示</Text>
        <View style={styles.iconGrid}>
          {SET_ICONS.map((icon) => {
            const selected = value.icon === icon;
            return (
              <PressableScale
                key={icon}
                scaleTo={0.92}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={SET_ICON_LABELS[icon]}
                onPress={() => {
                  haptics.select();
                  onChange({ ...value, icon });
                }}
                style={[styles.iconTile, selected && styles.iconTileSelected]}
              >
                <SymbolView
                  name={SET_ICON_SYMBOLS[icon]}
                  size={24}
                  weight={selected ? "semibold" : "regular"}
                  tintColor={selected ? colors.accentInk : colors.inkMuted}
                />
              </PressableScale>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 18 },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 4,
  },
  previewText: { flex: 1, gap: 2 },
  previewTitle: { ...type.title, fontSize: 20, color: colors.ink },
  previewSub: { ...type.hint, color: colors.inkMuted },
  error: {
    ...type.hint,
    color: colors.dangerInk,
    paddingHorizontal: 6,
  },
  iconSection: { gap: 10 },
  sectionLabel: {
    ...type.hint,
    fontWeight: "600",
    color: colors.inkMuted,
    paddingHorizontal: 4,
  },
  iconGrid: {
    flexDirection: "row",
    gap: 10,
  },
  iconTile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  iconTileSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.contrast,
  },
});
