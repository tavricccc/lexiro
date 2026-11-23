import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { openSet } from "@/components/library/folder-actions";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/ui/layout";
import { ListGroup, ListRow, PickerRow } from "@/components/ui/list";
import { SetIcon } from "@/components/ui/set-icon";
import { meaningLine } from "@/components/ui/swipeable-word-row";
import type { SetContent } from "@/core/contract";
import { KIND_LABELS } from "@/core/domain/labels";
import { ApiError, errorMessage } from "@/data/api";
import { SignInCancelled, signIn, useAuth } from "@/data/auth";
import { addShared, sharedSet } from "@/data/library";
import { useOnline } from "@/data/network";
import { keys, useLibrary } from "@/data/queries";
import { folderTree } from "@/lib/folders";
import { haptics } from "@/lib/haptics";
import { colors, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

const MAX_WORDS = 200;
const NO_FOLDER = "none";
const gone = (error: unknown) => error instanceof ApiError && error.status === 404;

/** What a shared set holds, and the way to add it. */
export function SharedSet({ code, folderId }: { code: string; folderId?: string }) {
  const { ready, account } = useAuth();
  const shared = useQuery({
    queryKey: keys.shared(code),
    queryFn: () => sharedSet(code),
    retry: (count, error) => !gone(error) && count < 2,
  });
  const content = shared.data;

  if (!content) {
    if (!shared.isError)
      return (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={colors.inkMuted as string} />
        </View>
      );
    return (
      <EmptyState
        icon={gone(shared.error) ? "link" : "wifi.exclamationmark"}
        title="無法開啟這個分享"
        description={errorMessage(shared.error)}
        action={
          gone(shared.error) ? undefined : (
            <Button
              label="重試"
              icon="arrow.clockwise"
              variant="secondary"
              onPress={() => void shared.refetch()}
            />
          )
        }
      />
    );
  }

  const kinds = new Map<string, number>();
  for (const question of content.questions)
    kinds.set(question.kind, (kinds.get(question.kind) ?? 0) + 1);

  return (
    <View style={styles.body}>
      <Panel>
        <View style={styles.summary}>
          <SetIcon icon={content.set.icon} size={48} />
          <View style={styles.summaryText}>
            <Text style={styles.name}>{content.set.name}</Text>
            <Text style={styles.desc}>
              {content.words.length} 個單字 · {content.questions.length} 題
            </Text>
          </View>
        </View>
        <Text style={styles.desc}>加入後會複製一份到你的帳號，之後可以自由修改和練習。</Text>
      </Panel>

      {!ready ? null : account ? (
        <AddShared code={code} content={content} folderId={folderId} />
      ) : (
        <Button
          label="用 Google 登入後加入"
          icon="person.badge.key.fill"
          size="lg"
          onPress={() => {
            signIn().catch((reason) => {
              if (reason instanceof SignInCancelled) return;
              haptics.error();
              toast.error(errorMessage(reason));
            });
          }}
        />
      )}

      {content.words.length > 0 ? (
        <ListGroup
          title="單字"
          footer={
            content.words.length > MAX_WORDS
              ? `還有 ${content.words.length - MAX_WORDS} 個單字，加入後可以看到全部。`
              : undefined
          }
        >
          {content.words.slice(0, MAX_WORDS).map((word) => (
            <ListRow key={word.id} title={word.word} latinTitle subtitle={meaningLine(word)} />
          ))}
        </ListGroup>
      ) : null}

      {kinds.size > 0 ? (
        <ListGroup title="題目">
          {[...kinds].map(([kind, count]) => (
            <ListRow
              key={kind}
              title={KIND_LABELS[kind as keyof typeof KIND_LABELS]}
              detail={`${count} 題`}
            />
          ))}
        </ListGroup>
      ) : null}
    </View>
  );
}

function AddShared({
  code,
  content,
  folderId,
}: {
  code: string;
  content: SetContent;
  folderId?: string;
}) {
  const library = useLibrary();
  const online = useOnline();
  const tree = folderTree(library.data?.folders ?? []);
  const [picked, setPicked] = useState(folderId ?? NO_FOLDER);
  const folder = tree.get(picked) ? picked : NO_FOLDER;
  const [busy, setBusy] = useState(false);

  if (library.data?.sets.some((set) => set.id === content.set.id))
    return (
      <Button
        label="開啟你的單字集"
        trailingIcon="arrow.right"
        size="lg"
        onPress={() => openSet(content.set.id)}
      />
    );

  const add = async () => {
    setBusy(true);
    try {
      const set = await addShared(code, folder === NO_FOLDER ? null : folder);
      haptics.success();
      toast.success(`已加入「${set.name}」`);
      openSet(set.id);
    } catch (reason) {
      haptics.error();
      toast.error(errorMessage(reason));
      setBusy(false);
    }
  };

  return (
    <>
      {tree.flat.length > 0 ? (
        <ListGroup>
          <PickerRow
            title="資料夾"
            icon="folder"
            value={folder}
            options={[
              { value: NO_FOLDER, label: "不放資料夾" },
              ...tree.flat.map(({ folder: entry }) => ({
                value: entry.id,
                label: tree.path(entry.id),
              })),
            ]}
            onChange={setPicked}
            disabled={busy}
          />
        </ListGroup>
      ) : null}
      <Button
        label="加入我的單字"
        icon="square.and.arrow.down"
        size="lg"
        busy={busy}
        disabled={!online || library.isPending}
        haptic="confirm"
        onPress={() => void add()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loader: { paddingVertical: 48, alignItems: "center" },
  body: { gap: 16 },
  summary: { flexDirection: "row", alignItems: "center", gap: 14 },
  summaryText: { flex: 1, gap: 2 },
  name: { ...type.title, fontSize: 19, color: colors.ink },
  desc: { ...type.body, color: colors.inkMuted },
});
