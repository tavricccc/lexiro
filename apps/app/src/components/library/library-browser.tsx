import { Button as SwiftButton, ContextMenu, Host, RNHostView } from "@expo/ui/swift-ui";
import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState, type ComponentProps, type ReactElement } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import {
  moveItem,
  newFolder,
  removeFolder,
  removeSet,
  renameFolder,
} from "@/components/library/folder-actions";
import { SyncRefreshControl } from "@/components/sync-refresh-control";
import { Button } from "@/components/ui/button";
import { EmptyState, Loaded, Screen } from "@/components/ui/layout";
import { PressableScale } from "@/components/ui/pressable-scale";
import { SetIcon } from "@/components/ui/set-icon";
import { barMenu } from "@/components/ui/sheet-header";
import type { Folder, LibraryIndex, SetSummary } from "@/core/contract";
import { useOnline } from "@/data/network";
import { orderedSets, useLibrary, useStarredWords } from "@/data/queries";
import { folderTree, type FolderTree } from "@/lib/folders";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, type } from "@/lib/theme";

/** One level of the library: the folders and sets directly inside `folderId` (null is the top). */
export function LibraryBrowser({ folderId }: { folderId: string | null }) {
  const library = useLibrary();
  const online = useOnline();
  const [query, setQuery] = useState("");
  const tree = useMemo(() => folderTree(library.data?.folders ?? []), [library.data?.folders]);
  const folder = tree.get(folderId);
  const missing = folderId !== null && !folder;

  return (
    <>
      <Stack.Screen
        options={{
          title: folderId === null ? "我的單字" : (folder?.name ?? "資料夾"),
          headerSearchBarOptions: {
            placeholder: folderId === null ? "搜尋單字集和資料夾" : "在這個資料夾搜尋",
            onChangeText: (event) => setQuery(event.nativeEvent.text),
            onCancelButtonPress: () => setQuery(""),
          },
          unstable_headerRightItems: () => [
            ...(folder
              ? [
                  barMenu("資料夾動作", "ellipsis", [
                    {
                      label: "重新命名",
                      symbol: "pencil",
                      disabled: !online,
                      onPress: () => renameFolder(folder),
                    },
                    {
                      label: "移動…",
                      symbol: "folder",
                      disabled: !online,
                      onPress: () => moveItem({ folder: folder.id }),
                    },
                    {
                      label: "刪除資料夾",
                      symbol: "trash",
                      destructive: true,
                      disabled: !online,
                      onPress: () => removeFolder(folder, () => router.back()),
                    },
                  ]),
                ]
              : []),
            ...(missing
              ? []
              : [
                  barMenu("新增", "plus", [
                    {
                      label: "新增單字集",
                      symbol: "plus.rectangle.on.rectangle",
                      onPress: () =>
                        router.push({
                          pathname: "/sets/new",
                          params: folderId ? { folder: folderId } : {},
                        }),
                    },
                    {
                      label: "用代碼加入",
                      symbol: "number",
                      disabled: !online,
                      onPress: () =>
                        router.push({
                          pathname: "/sets/join",
                          params: folderId ? { folder: folderId } : {},
                        }),
                    },
                    {
                      label: "新增資料夾",
                      symbol: "folder.badge.plus",
                      disabled: !online,
                      onPress: () => newFolder(folderId, tree.children(folderId).length),
                    },
                  ]),
                ]),
          ],
        }}
      />
      <Screen refreshControl={<SyncRefreshControl />}>
        <Loaded query={library}>
          {(data) =>
            missing ? (
              <EmptyState icon="folder" title="找不到這個資料夾" />
            ) : (
              <Level data={data} tree={tree} folderId={folderId} query={query} online={online} />
            )
          }
        </Loaded>
      </Screen>
    </>
  );
}

function Level({
  data,
  tree,
  folderId,
  query,
  online,
}: {
  data: LibraryIndex;
  tree: FolderTree;
  folderId: string | null;
  query: string;
  online: boolean;
}) {
  const starred = useStarredWords();
  const root = folderId === null;
  const needle = query.trim().toLocaleLowerCase();
  // Searching looks through everything below this level.
  const scope = folderId === null ? null : tree.within(folderId);
  const homeOf = (set: SetSummary) => (tree.get(set.folderId) ? set.folderId : null);

  const folders = needle
    ? tree.flat
        .map((entry) => entry.folder)
        .filter(
          (entry) =>
            entry.id !== folderId &&
            (!scope || scope.has(entry.id)) &&
            entry.name.toLocaleLowerCase().includes(needle),
        )
    : tree.children(folderId);
  const sets = orderedSets(
    data.sets.filter((set) => {
      const home = homeOf(set);
      if (!needle) return home === folderId;
      return (
        (!scope || (home !== null && scope.has(home))) &&
        set.name.toLocaleLowerCase().includes(needle)
      );
    }),
  );
  const place = (id: string | null) => (needle && id ? tree.path(id) : undefined);

  if (root && !data.sets.length && !data.folders.length) {
    return (
      <EmptyState
        icon="books.vertical"
        title="還沒有單字集"
        description="單字集是一組要一起練習的單字，例如一課課文或一次考試的範圍。"
        action={
          <View style={styles.emptyActions}>
            <Button label="建立第一個單字集" icon="plus" onPress={() => router.push("/sets/new")} />
            <Button
              label="用代碼加入"
              icon="number"
              variant="ghost"
              disabled={!online}
              onPress={() => router.push("/sets/join")}
            />
          </View>
        }
      />
    );
  }

  return (
    <View style={styles.body}>
      {root && !needle && starred.count > 0 ? (
        <PressableScale
          scaleTo={0.98}
          onPress={() => {
            haptics.tap();
            router.push("/library/starred");
          }}
          style={styles.card}
        >
          <View style={[styles.icon, styles.starredIcon]}>
            <SymbolView name="star.fill" size={20} weight="semibold" tintColor={colors.highlight} />
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardTitle}>標星單字</Text>
            <Text style={styles.cardSub}>
              <Text style={latin.semibold}>{starred.count}</Text> 個字
            </Text>
          </View>
          <Chevron />
        </PressableScale>
      ) : null}

      {folders.length + sets.length > 0 ? (
        <View style={styles.list}>
          {folders.map((entry) => {
            const inside = tree.within(entry.id);
            return (
              <FolderCard
                key={entry.id}
                folder={entry}
                count={
                  data.sets.filter((set) => set.folderId !== null && inside.has(set.folderId)).length
                }
                place={place(entry.parentId)}
                online={online}
              />
            );
          })}
          {sets.map((set) => (
            <SetCard key={set.id} set={set} place={place(homeOf(set))} online={online} />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>
          {needle ? `沒有符合「${query.trim()}」的結果` : root ? "" : "這個資料夾是空的"}
        </Text>
      )}
    </View>
  );
}

type MenuAction = {
  label: string;
  systemImage: ComponentProps<typeof SwiftButton>["systemImage"];
  destructive?: boolean;
  onPress: () => void;
};

/** A card with the system long-press menu. */
function MenuCard({ actions, children }: { actions: MenuAction[]; children: ReactElement }) {
  if (Platform.OS !== "ios" || !actions.length) return children;
  return (
    <Host matchContents={{ vertical: true }} style={styles.menuHost}>
      <ContextMenu>
        <ContextMenu.Trigger>
          <RNHostView matchContents={{ vertical: true }}>{children}</RNHostView>
        </ContextMenu.Trigger>
        <ContextMenu.Items>
          {actions.map((action) => (
            <SwiftButton
              key={action.label}
              label={action.label}
              systemImage={action.systemImage}
              role={action.destructive ? "destructive" : undefined}
              onPress={() => {
                haptics.select();
                action.onPress();
              }}
            />
          ))}
        </ContextMenu.Items>
      </ContextMenu>
    </Host>
  );
}

function Chevron() {
  return <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={colors.inkFaint} />;
}

function FolderCard({
  folder,
  count,
  place,
  online,
}: {
  folder: Folder;
  count: number;
  place?: string;
  online: boolean;
}) {
  const actions: MenuAction[] = online
    ? [
        { label: "重新命名", systemImage: "pencil", onPress: () => renameFolder(folder) },
        { label: "移動…", systemImage: "folder", onPress: () => moveItem({ folder: folder.id }) },
        {
          label: "刪除資料夾",
          systemImage: "trash",
          destructive: true,
          onPress: () => removeFolder(folder),
        },
      ]
    : [];
  return (
    <MenuCard actions={actions}>
      <PressableScale
        scaleTo={0.985}
        onPress={() => {
          haptics.select();
          router.push({ pathname: "/library/folder/[folderId]", params: { folderId: folder.id } });
        }}
        style={styles.card}
      >
        <View style={[styles.icon, styles.folderIcon]}>
          <SymbolView name="folder.fill" size={21} tintColor={colors.ink} />
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {folder.name}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            <Text style={latin.semibold}>{count}</Text> 個單字集
            {place ? ` · ${place}` : ""}
          </Text>
        </View>
        <Chevron />
      </PressableScale>
    </MenuCard>
  );
}

function SetCard({ set, place, online }: { set: SetSummary; place?: string; online: boolean }) {
  const actions: MenuAction[] = [];
  if (set.wordCount > 0)
    actions.push({
      label: "開始練習",
      systemImage: "play.fill",
      onPress: () => router.push({ pathname: "/practice", params: { set: set.id } }),
    });
  actions.push(
    {
      label: "分享單字集",
      systemImage: "square.and.arrow.up",
      onPress: () => router.push({ pathname: "/sets/[setId]/share", params: { setId: set.id } }),
    },
    {
      label: "單字集設定",
      systemImage: "gearshape",
      onPress: () => router.push({ pathname: "/sets/[setId]/settings", params: { setId: set.id } }),
    },
  );
  if (online)
    actions.push(
      { label: "移動…", systemImage: "folder", onPress: () => moveItem({ set: set.id }) },
      {
        label: "刪除單字集",
        systemImage: "trash",
        destructive: true,
        onPress: () => removeSet(set),
      },
    );
  return (
    <MenuCard actions={actions}>
      <PressableScale
        scaleTo={0.985}
        onPress={() => {
          haptics.select();
          router.push({ pathname: "/library/[setId]", params: { setId: set.id } });
        }}
        style={styles.card}
      >
        <SetIcon icon={set.icon} size={44} />
        <View style={styles.cardMeta}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {set.name}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            <Text style={latin.semibold}>{set.wordCount}</Text> 個單字
            {set.questionCount ? (
              <>
                {" · "}
                <Text style={latin.semibold}>{set.questionCount}</Text> 題
              </>
            ) : null}
            {place ? ` · ${place}` : ""}
          </Text>
        </View>
        <Chevron />
      </PressableScale>
    </MenuCard>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  list: { gap: 10 },
  menuHost: { alignSelf: "stretch" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderCurve: "continuous",
    padding: 14,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  starredIcon: { backgroundColor: colors.highlightSoft },
  folderIcon: { backgroundColor: colors.surfaceRaised },
  cardMeta: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.ink },
  cardSub: { ...type.hint, color: colors.inkMuted },
  emptyActions: { gap: 10 },
  empty: {
    ...type.body,
    color: colors.inkMuted,
    textAlign: "center",
    paddingVertical: 32,
  },
});
