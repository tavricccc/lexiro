import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Share, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Loaded, Panel, Screen } from "@/components/ui/layout";
import { ActionRow, ListGroup } from "@/components/ui/list";
import { SheetHeader } from "@/components/ui/sheet-header";
import { errorMessage } from "@/data/api";
import { shareOf, shareSet, unshareSet } from "@/data/library";
import { useOnline } from "@/data/network";
import { keys, queryClient, useSet } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, latin, type } from "@/lib/theme";
import { WEB_ORIGIN } from "@/platform/config";
import { toast } from "@/platform/toast";

/** Whoever has a set's link or code sees its current words; stopping closes it for everyone. */
export default function ShareSetSheet() {
  const { setId = "" } = useLocalSearchParams<{ setId: string }>();
  const name = useSet(setId).data?.set.name ?? "單字集";
  const online = useOnline();
  const share = useQuery({
    queryKey: keys.share(setId),
    queryFn: () => shareOf(setId),
    enabled: Boolean(setId),
    staleTime: 0,
  });
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    try {
      queryClient.setQueryData(keys.share(setId), await action());
      haptics.success();
    } catch (reason) {
      haptics.error();
      toast.error(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const confirmStop = () =>
    Alert.alert("停止分享？", "現在的連結和代碼會失效，已經加入的人不受影響。", [
      { text: "取消", style: "cancel" },
      {
        text: "停止分享",
        style: "destructive",
        onPress: () =>
          void run(async () => {
            await unshareSet(setId);
            return null;
          }),
      },
    ]);

  return (
    <>
      <SheetHeader title={`分享「${name}」`} />
      <Screen>
        <Loaded query={share}>
          {(code) =>
            code ? (
              <Shared code={code} name={name} stopDisabled={busy || !online} onStop={confirmStop} />
            ) : (
              <Panel>
                <Text style={styles.desc}>
                  拿到連結或代碼的人都能看到這個單字集目前的單字，並複製到自己的帳號。
                </Text>
                <Button
                  label="開始分享"
                  icon="square.and.arrow.up"
                  size="lg"
                  busy={busy}
                  disabled={!online}
                  haptic="confirm"
                  onPress={() => void run(() => shareSet(setId))}
                />
              </Panel>
            )
          }
        </Loaded>
      </Screen>
    </>
  );
}

function Shared({
  code,
  name,
  stopDisabled,
  onStop,
}: {
  code: string;
  name: string;
  stopDisabled: boolean;
  onStop: () => void;
}) {
  const url = `${WEB_ORIGIN}/shared/${code}`;
  return (
    <View style={styles.body}>
      <Panel style={styles.codePanel}>
        <Text
          accessibilityLabel={`分享代碼 ${code.split("").join(" ")}`}
          adjustsFontSizeToFit
          numberOfLines={1}
          selectable
          style={[styles.code, code.length > 12 && styles.longCode]}
        >
          {code}
        </Text>
        <View style={styles.buttons}>
          <CopyButton label="複製代碼" text={code} />
          <CopyButton label="複製連結" text={url} />
        </View>
      </Panel>
      <Button
        label="分享連結…"
        icon="square.and.arrow.up"
        size="lg"
        onPress={() => {
          // iOS attaches `url` itself; Android only sends the message.
          void Share.share(
            Platform.OS === "ios" ? { url } : { title: name, message: `${name}\n${url}` },
          ).catch(() => {});
        }}
      />
      <ListGroup>
        <ActionRow
          title="停止分享"
          icon="xmark.circle"
          destructive
          disabled={stopDisabled}
          onPress={onStop}
        />
      </ListGroup>
    </View>
  );
}

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      label={copied ? "已複製" : label}
      icon={copied ? "checkmark" : "doc.on.doc"}
      variant="ghost"
      haptic="none"
      style={styles.flex}
      onPress={() => {
        void Clipboard.setStringAsync(text).then(() => {
          haptics.success();
          setCopied(true);
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  codePanel: { gap: 18, paddingTop: 26 },
  code: {
    ...latin.bold,
    fontSize: 34,
    letterSpacing: 5,
    color: colors.ink,
    textAlign: "center",
  },
  longCode: { fontSize: 18, letterSpacing: 0 },
  buttons: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  desc: { ...type.body, color: colors.inkMuted },
});
