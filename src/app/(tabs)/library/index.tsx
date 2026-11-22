import { Button as SwiftButton, ContextMenu, Host, RNHostView } from "@expo/ui/swift-ui";
import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { SyncRefreshControl } from "@/components/sync-refresh-control";
import { Button } from "@/components/ui/button";
import { EmptyState, Loaded, Screen } from "@/components/ui/layout";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Segmented } from "@/components/ui/segmented";
import { SetIcon } from "@/components/ui/set-icon";
import type { Folder, SetSummary } from "@/core/contract";
import { errorMessage } from "@/data/api";
import { deleteSet } from "@/data/library";
import { useOnline } from "@/data/network";
import { orderedSets, useLibrary, useStarredWords } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

const ALL = "all";
const LOOSE = "none";

export default function LibraryScreen() {
  const library = useLibrary();
  const [folder, setFolder] = useState(ALL);
  const [query, setQuery] = useState("");

  return (
    <>
      <Stack.Screen
        options={{
          title: "我的單字",
          headerSearchBarOptions: {
            placeholder: "搜尋單字集",
            onChangeText: (event) => setQuery(event.nativeEvent.text),
            onCancelButtonPress: () => setQuery(""),
          },
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                hitSlop={8}
                accessibilityLabel="管理資料夾"
                onPress={() => {
                  haptics.select();
                  router.push("/sets/folders");
                }}
                style={styles.headerBtn}
              >
                <SymbolView
                  name="folder.badge.gearshape"
                  size={20}
                  weight="medium"
                  tintColor={colors.ink}
                />
              </Pressable>
              <Pressable
                hitSlop={8}
                accessibilityLabel="新增單字集"
                onPress={() => {
                  haptics.tap();
                  router.push({
                    pathname: "/sets/new",
                    params: folder !== ALL && folder !== LOOSE ? { folder } : {},
                  });
                }}
                style={[styles.headerBtn, styles.headerBtnPrimary]}
              >
                <SymbolView name="plus" size={17} weight="bold" tintColor={colors.onContrast} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Screen refreshControl={<SyncRefreshControl />}>
        <Loaded query={library}>
          {({ folders, sets }) => (
            <LibraryBody
              folder={folder}
              folders={folders}
              sets={sets}
              query={query}
              onFolder={setFolder}
            />
          )}
        </Loaded>
      </Screen>
    </>
  );
}

function LibraryBody({
  folder,
  folders,
  sets,
  query,
  onFolder,
}: {
  folder: string;
  folders: Folder[];
  sets: SetSummary[];
  query: string;
  onFolder: (folder: string) => void;
}) {
  const starred = useStarredWords();
  const online = useOnline();

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const inFolder = (set: SetSummary) =>
      folder === ALL || (folder === LOOSE ? !set.folderId : set.folderId === folder);
    return orderedSets(
      sets.filter(
        (set) => inFolder(set) && (!needle || set.name.toLocaleLowerCase().includes(needle)),
      ),
    );
  }, [sets, folder, query]);

  if (!sets.length) {
    return (
      <EmptyState
        icon="books.vertical"
        title="還沒有單字集"
        description="單字集是一組要一起練習的單字，例如一課課文或一次考試的範圍。"
        action={
          <Button
            label="建立第一個單字集"
            icon="plus"
            onPress={() => router.push("/sets/new")}
          />
        }
      />
    );
  }

  const options = [
    { value: ALL, label: "全部" },
    ...folders.map((entry) => ({ value: entry.id, label: entry.name })),
    ...(sets.some((set) => !set.folderId) && folders.length
      ? [{ value: LOOSE, label: "未分類" }]
      : []),
  ];
  const activeFolder = options.some((option) => option.value === folder) ? folder : ALL;

  const confirmDelete = (set: SetSummary) => {
    haptics.warning();
    Alert.alert(
      `刪除「${set.name}」？`,
      `${set.wordCount} 個單字和 ${set.questionCount} 題會一起刪除，無法復原。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => {
            deleteSet(set.id)
              .then(() => {
                haptics.success();
                toast.success(`已刪除「${set.name}」`);
              })
              .catch((reason) => {
                haptics.error();
                toast.error(errorMessage(reason));
              });
          },
        },
      ],
    );
  };

  return (
    <View style={styles.body}>
      {!query && starred.count > 0 ? (
        <PressableScale
          scaleTo={0.98}
          onPress={() => {
            haptics.tap();
            router.push("/library/starred");
          }}
          style={styles.starredCard}
        >
          <View style={styles.starredIcon}>
            <SymbolView name="star.fill" size={20} weight="semibold" tintColor={colors.highlight} />
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardTitle}>標星單字</Text>
            <Text style={styles.cardSub}>
              <Text style={latin.semibold}>{starred.count}</Text> 個字
            </Text>
          </View>
          <SymbolView
            name="chevron.right"
            size={13}
            weight="semibold"
            tintColor={colors.inkFaint}
          />
        </PressableScale>
      ) : null}

      {folders.length > 0 ? (
        <Segmented
          scrollable
          options={options}
          value={activeFolder}
          onChange={onFolder}
        />
      ) : null}

      {visible.length > 0 ? (
        <View style={styles.list}>
          {visible.map((set) => (
            <SetCard
              key={set.id}
              set={set}
              online={online}
              onDelete={() => confirmDelete(set)}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyFilter}>
          {query ? `沒有符合「${query}」的單字集` : "這個資料夾還是空的"}
        </Text>
      )}
    </View>
  );
}

function SetCard({
  set,
  online,
  onDelete,
}: {
  set: SetSummary;
  online: boolean;
  onDelete: () => void;
}) {
  const card = (
    <PressableScale
      scaleTo={0.985}
      onPress={() => {
        haptics.select();
        router.push({ pathname: "/library/[setId]", params: { setId: set.id } });
      }}
      style={styles.setCard}
    >
      <SetIcon icon={set.icon} size={44} />
      <View style={styles.cardMeta}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {set.name}
        </Text>
        <Text style={styles.cardSub}>
          <Text style={latin.semibold}>{set.wordCount}</Text> 個單字
          {set.questionCount ? (
            <>
              {" · "}
              <Text style={latin.semibold}>{set.questionCount}</Text> 題
            </>
          ) : null}
        </Text>
      </View>
      <SymbolView
        name="chevron.right"
        size={13}
        weight="semibold"
        tintColor={colors.inkFaint}
      />
    </PressableScale>
  );

  if (Platform.OS !== "ios") return card;

  return (
    <Host matchContents={{ vertical: true }} style={styles.menuHost}>
      <ContextMenu>
        <ContextMenu.Trigger>
          <RNHostView matchContents={{ vertical: true }}>{card}</RNHostView>
        </ContextMenu.Trigger>
        <ContextMenu.Items>
          {set.wordCount > 0 ? (
            <SwiftButton
              label="開始練習"
              systemImage="play.fill"
              onPress={() => {
                haptics.confirm();
                router.push({ pathname: "/practice", params: { set: set.id } });
              }}
            />
          ) : null}
          <SwiftButton
            label="分享單字集"
            systemImage="square.and.arrow.up"
            onPress={() => {
              haptics.select();
              router.push({ pathname: "/sets/[setId]/share", params: { setId: set.id } });
            }}
          />
          <SwiftButton
            label="單字集設定"
            systemImage="gearshape"
            onPress={() => {
              haptics.select();
              router.push({ pathname: "/sets/[setId]/settings", params: { setId: set.id } });
            }}
          />
          {online ? (
            <SwiftButton
              label="刪除單字集"
              systemImage="trash"
              role="destructive"
              onPress={onDelete}
            />
          ) : null}
        </ContextMenu.Items>
      </ContextMenu>
    </Host>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnPrimary: {
    backgroundColor: colors.contrast,
  },
  body: {
    gap: 14,
  },
  starredCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderCurve: "continuous",
    padding: 14,
  },
  starredIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: colors.highlightSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    gap: 10,
  },
  menuHost: { alignSelf: "stretch" },
  setCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderCurve: "continuous",
    padding: 14,
  },
  cardMeta: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
  },
  cardSub: {
    ...type.hint,
    color: colors.inkMuted,
  },
  emptyFilter: {
    ...type.body,
    color: colors.inkMuted,
    textAlign: "center",
    paddingVertical: 32,
  },
});
