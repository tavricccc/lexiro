import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Share, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Panel, Screen } from "@/components/ui/layout";
import { SheetHeader } from "@/components/ui/sheet-header";
import { errorMessage } from "@/data/api";
import { shareOf, shareSet, unshareSet } from "@/data/library";
import { useSet } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, type } from "@/lib/theme";
import { WEB_ORIGIN } from "@/platform/config";
import { toast } from "@/platform/toast";

export default function ShareSetSheet() {
  const { setId = "" } = useLocalSearchParams<{ setId: string }>();
  const set = useSet(setId).data?.set;
  const [link, setLink] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!setId) return;
    let cancelled = false;
    shareOf(setId).then(
      (id) => {
        if (!cancelled) setLink(id);
      },
      (reason) => {
        if (cancelled) return;
        toast.error(errorMessage(reason));
        setLink(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [setId]);

  const url = link ? `${WEB_ORIGIN}/shared/${link}` : "";

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (reason) {
      haptics.error();
      toast.error(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <SheetHeader
        title={`分享「${set?.name ?? "單字集"}」`}
        subtitle="拿到連結的人都能看到這個單字集目前的單字，並複製到自己的帳號。"
      />
      <Screen>
        {link === undefined ? (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color={colors.contrast as string} />
          </View>
        ) : link ? (
          <Panel>
            <View style={styles.urlBox}>
              <Text style={styles.urlText} selectable>
                {url}
              </Text>
            </View>
            <View style={styles.btnRow}>
              <Button
                label="複製連結"
                icon="doc.on.doc"
                variant="primary"
                style={styles.flexBtn}
                onPress={() => {
                  void Clipboard.setStringAsync(url).then(() => {
                    haptics.success();
                    toast.success("已複製分享連結");
                  });
                }}
              />
              <Button
                label="分享…"
                icon="square.and.arrow.up"
                variant="secondary"
                style={styles.flexBtn}
                onPress={() => {
                  void Share.share({
                    title: set?.name ?? "Lexiro 單字集",
                    message: `${set?.name ?? "Lexiro 單字集"}\n${url}`,
                    url,
                  });
                }}
              />
            </View>
            <Button
              label="停止分享"
              icon="link.badge.plus"
              variant="danger"
              busy={busy}
              onPress={() =>
                void run(async () => {
                  await unshareSet(setId);
                  setLink(null);
                  haptics.success();
                  toast.success("已停止分享");
                })
              }
            />
          </Panel>
        ) : (
          <Panel>
            <Text style={styles.desc}>
              建立分享連結後，朋友點開就能預覽並複製這份單字集。隨時可以停止分享。
            </Text>
            <Button
              label="建立分享連結"
              icon="link"
              size="lg"
              busy={busy}
              haptic="confirm"
              onPress={() =>
                void run(async () => {
                  const id = await shareSet(setId);
                  setLink(id);
                  haptics.success();
                })
              }
            />
          </Panel>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  loader: { paddingVertical: 40, alignItems: "center" },
  urlBox: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    padding: 14,
  },
  urlText: {
    ...latin.medium,
    fontSize: 14,
    color: colors.ink,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  flexBtn: { flex: 1 },
  desc: {
    ...type.body,
    color: colors.inkMuted,
  },
});
