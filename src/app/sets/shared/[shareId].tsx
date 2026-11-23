import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { EmptyState, Panel, Screen } from "@/components/ui/layout";
import { ListGroup, ListRow } from "@/components/ui/list";
import { SetIcon } from "@/components/ui/set-icon";
import { SheetHeader } from "@/components/ui/sheet-header";
import { meaningLine } from "@/components/ui/swipeable-word-row";
import type { LibraryIndex } from "@/core/contract";
import { KIND_LABELS } from "@/core/domain/labels";
import { api, ApiError, errorMessage } from "@/data/api";
import { useAuth } from "@/data/auth";
import { sharedSet } from "@/data/library";
import { invalidate, keys, queryClient } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

export default function SharedSetScreen() {
  const { shareId = "" } = useLocalSearchParams<{ shareId: string }>();
  const { account } = useAuth();
  const [busy, setBusy] = useState(false);

  const shared = useQuery({
    queryKey: keys.shared(shareId),
    queryFn: () => sharedSet(shareId),
    enabled: Boolean(shareId),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });

  const add = async () => {
    if (!shared.data) return;
    setBusy(true);
    try {
      const before = new Set((await api<LibraryIndex>("/library")).sets.map((set) => set.id));
      await api("/backup", {
        method: "POST",
        json: {
          version: 1,
          folders: [],
          sets: [
            {
              ...shared.data,
              set: { ...shared.data.set, folderId: null, order: null },
            },
          ],
        },
      });
      await invalidate();
      const after = queryClient.getQueryData<LibraryIndex>(keys.library);
      const created = after?.sets.find((set) => !before.has(set.id));
      haptics.success();
      toast.success(`已加入「${shared.data.set.name}」`);
      if (created) {
        router.replace({ pathname: "/library/[setId]", params: { setId: created.id } });
      } else {
        router.back();
      }
    } catch (reason) {
      haptics.error();
      toast.error(errorMessage(reason));
      setBusy(false);
    }
  };

  const content = shared.data;
  const questionGroups = new Map<string, number>();
  for (const q of content?.questions ?? []) {
    questionGroups.set(q.kind, (questionGroups.get(q.kind) ?? 0) + 1);
  }

  return (
    <View style={styles.root}>
      <SheetHeader
        title={content?.set.name ?? "分享單字集"}
        subtitle={
          content ? `${content.words.length} 個單字 · ${content.questions.length} 題` : undefined
        }
        leading={content ? <SetIcon icon={content.set.icon} size={36} /> : undefined}
      />
      <Screen>
        {shared.isError ? (
          <EmptyState
            icon="link.badge.plus"
            title="無法開啟這個分享"
            description={errorMessage(shared.error)}
          />
        ) : !content ? (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color={colors.inkMuted as string} />
          </View>
        ) : (
          <View style={styles.body}>
            <Panel>
              <Text style={styles.desc}>
                有人分享了這個單字集給你。加入後會複製一份到你的帳號，之後可以自由修改和練習。
              </Text>
              {account ? (
                <Button
                  label="加入我的單字"
                  icon="square.and.arrow.down"
                  size="lg"
                  busy={busy}
                  haptic="confirm"
                  onPress={() => void add()}
                />
              ) : (
                <Text style={styles.desc}>請先登入 Lexiro 帳號以加入這個單字集。</Text>
              )}
            </Panel>

            <ListGroup title="單字">
              {content.words.slice(0, 200).map((word) => (
                <ListRow
                  key={word.id}
                  title={word.word}
                  latinTitle
                  subtitle={meaningLine(word)}
                />
              ))}
            </ListGroup>
            {content.words.length > 200 ? (
              <Text style={styles.more}>
                還有 {content.words.length - 200} 個單字，加入後可以看到全部。
              </Text>
            ) : null}

            {questionGroups.size > 0 ? (
              <ListGroup title="題目">
                {[...questionGroups].map(([kind, count]) => (
                  <ListRow
                    key={kind}
                    title={KIND_LABELS[kind as keyof typeof KIND_LABELS]}
                    detail={`${count} 題`}
                  />
                ))}
              </ListGroup>
            ) : null}
          </View>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  loader: { paddingVertical: 48, alignItems: "center" },
  body: { gap: 16 },
  desc: { ...type.body, color: colors.inkMuted },
  more: { ...type.hint, color: colors.inkMuted, textAlign: "center" },
});
