import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef } from "react";
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Chip, CONTENT_MAX_WIDTH, EmptyState, Panel } from "@/components/ui/layout";
import { ScrollMore, useScrollMore } from "@/components/ui/scroll-more";
import { fade, Tone } from "@/components/ui/tone";
import { ListGroup, ListRow } from "@/components/ui/list";
import { SheetHeader } from "@/components/ui/sheet-header";
import { enterDown, glide, pop, slideNext, swapIn } from "@/components/ui/motion";
import { PressableScale } from "@/components/ui/pressable-scale";
import { ProgressBar } from "@/components/ui/progress";
import { TASK_LABELS } from "@/core/domain/labels";
import { passageParts } from "@/core/domain/practice";
import type { LiveQuestion, RoomPlayer, RoomState } from "@/core/domain/room";
import { useAuth } from "@/data/auth";
import { useRemaining, useRoomSocket } from "@/data/room-socket";
import { haptics } from "@/lib/haptics";
import { colors, hasLatin, latin, radius, space, type } from "@/lib/theme";
import { WEB_ORIGIN } from "@/platform/config";
import { toast } from "@/platform/toast";

type Send = ReturnType<typeof useRoomSocket>["send"];

export default function LiveRoomScreen() {
  const { code = "" } = useLocalSearchParams<{ code: string }>();
  const { account } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const room = useRoomSocket(code.toUpperCase(), account?.name.slice(0, 40) || "Player");
  const { state, connection } = room;
  const { scrollProps, more, scrollOn } = useScrollMore();

  return (
    <View style={[styles.root, { paddingTop: headerHeight }]}>
      <SheetHeader title={state?.title ?? "對戰"} closeLabel="離開房間" />
      <View style={styles.column}>
        {connection === "reconnecting" ? (
          <View style={styles.header}>
            <Chip label="重新連線中…" tone="highlight" />
          </View>
        ) : null}

        <ScrollView
          {...scrollProps}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {connection === "failed" || connection === "replaced" ? (
            <EmptyState
              icon="wifi.exclamationmark"
              title="無法留在這個房間"
              description={
                connection === "replaced" ? "你在另一台裝置進入了這個房間。" : room.error
              }
              action={<Button label="回到對戰" onPress={() => router.back()} />}
            />
          ) : !state ? (
            <View style={styles.loader}>
              <ActivityIndicator size="small" color={colors.inkMuted as string} />
              <Text style={styles.loaderText}>正在進入房間…</Text>
            </View>
          ) : state.phase === "lobby" ? (
            <LobbyView host={state.you === state.hostUid} send={room.send} state={state} />
          ) : state.phase === "ended" ? (
            <EndedView state={state} />
          ) : (
            <Animated.View key={state.index} entering={slideNext} style={styles.liveWrap}>
              <LiveQuestionView
                host={state.you === state.hostUid}
                offset={room.offset}
                send={room.send}
                state={state}
              />
            </Animated.View>
          )}
        </ScrollView>
        <ScrollMore visible={more} onPress={scrollOn} bottom={Math.max(insets.bottom, 8) + 8} />
      </View>
    </View>
  );
}

function LobbyView({ state, host, send }: { state: RoomState; host: boolean; send: Send }) {
  const link = `${WEB_ORIGIN}/app/rooms/${state.code}`;

  return (
    <View style={styles.section}>
      <Panel style={styles.lobbyCard}>
        <Text style={styles.muted}>房間代碼</Text>
        <Text style={styles.bigCode} selectable>
          {state.code}
        </Text>
        <View style={styles.lobbyBtns}>
          <Button
            label="複製邀請"
            icon="doc.on.doc"
            variant="secondary"
            onPress={() => {
              void Clipboard.setStringAsync(link).then(() => {
                haptics.success();
                toast.success("已複製邀請連結");
              });
            }}
          />
          <Button
            label="分享…"
            icon="square.and.arrow.up"
            variant="secondary"
            onPress={() => {
              void Share.share({
                title: state.title,
                message: `一起來 Lexiro 對戰！房間代碼：${state.code}\n${link}`,
                url: link,
              });
            }}
          />
        </View>
        <Text style={styles.muted}>共 {state.total} 題</Text>
      </Panel>

      <Scoreboard
        hostUid={state.hostUid}
        players={state.players}
        title={`玩家 ${state.players.length}/8`}
        you={state.you}
      />

      {host ? (
        <Button
          label="開始對戰"
          icon="play.fill"
          size="lg"
          haptic="confirm"
          onPress={() => send({ type: "start" })}
        />
      ) : (
        <Text style={styles.waitHint}>等房主開始…</Text>
      )}
    </View>
  );
}

function LiveQuestionView({
  state,
  host,
  send,
  offset,
}: {
  state: RoomState;
  host: boolean;
  send: Send;
  offset: number;
}) {
  const remaining = useRemaining(state.endsAt, offset);
  const question = state.question;
  const warnedRef = useRef<number>(-1);
  const revealedRef = useRef<number>(-1);

  useEffect(() => {
    if (
      !state.reveal &&
      remaining !== null &&
      remaining > 0 &&
      remaining <= 5000 &&
      warnedRef.current !== state.index
    ) {
      warnedRef.current = state.index;
      haptics.warning();
    }
  }, [remaining, state.index, state.reveal]);

  useEffect(() => {
    if (state.reveal && revealedRef.current !== state.index) {
      revealedRef.current = state.index;
      if (state.reveal.gained[state.you]) haptics.success();
      else haptics.error();
    }
  }, [state.index, state.reveal, state.you]);

  if (!question) return null;
  const reveal = state.reveal;
  const chosen = state.yourChoice;
  const used = new Set(
    question.sharedBank
      ? Object.entries(state.revealedBlanks)
          .filter(([blank]) => Number(blank) !== question.blank)
          .map(([, option]) => option)
      : [],
  );
  const gained = reveal?.gained[state.you];
  const answered = state.players.filter((player) => player.answered).length;
  const ratio = remaining !== null && state.duration ? remaining / state.duration : 0;

  return (
    <View style={styles.section}>
      <View style={styles.liveMeta}>
        <Chip label={TASK_LABELS[question.type]} />
        <Text style={styles.muted}>
          第 {state.index + 1} / {state.total} 題
        </Text>
        <Text style={styles.answeredMeta}>
          {reveal ? "看結果" : `${answered}/${state.players.length} 已作答`}
        </Text>
      </View>

      <ProgressBar
        value={ratio}
        tint={!reveal && remaining !== null && remaining <= 5000 ? colors.danger : colors.contrast}
      />

      <RoomPrompt question={question} revealed={state.revealedBlanks} />

      <View style={styles.optionList}>
        {question.options.map((option, index) => {
          const right = Boolean(reveal?.accepted.includes(index));
          const picked = chosen === index;
          const wrong = Boolean(reveal) && picked && !right;
          const locked = chosen !== null || Boolean(reveal) || used.has(option);
          return (
            <Animated.View
              key={index}
              style={[fade, { opacity: locked && !picked && !(reveal && right) ? 0.5 : 1 }]}
            >
              <PressableScale
                scaleTo={0.97}
                disabled={locked}
                onPress={() => {
                  haptics.tap();
                  send({ type: "answer", index: state.index, choice: index });
                }}
                style={styles.roomOption}
              >
                <Tone
                  on={!reveal && picked}
                  outset={1.5}
                  style={[styles.roomTone, styles.roomOptionPicked]}
                />
                <Tone
                  on={Boolean(reveal) && right}
                  outset={1.5}
                  style={[styles.roomTone, styles.roomOptionRight]}
                />
                <Tone on={wrong} outset={1.5} style={[styles.roomTone, styles.roomOptionWrong]} />
                <View style={styles.roomBadge}>
                  <Tone
                    on={Boolean(reveal) && right}
                    style={[styles.roomBadgeTone, styles.roomBadgeRight]}
                  />
                  <Tone on={wrong} style={[styles.roomBadgeTone, styles.roomBadgeWrong]} />
                  {reveal && right ? (
                    <Animated.View entering={pop}>
                      <SymbolView name="checkmark" size={13} weight="bold" tintColor="#ffffff" />
                    </Animated.View>
                  ) : wrong ? (
                    <Animated.View entering={pop}>
                      <SymbolView name="xmark" size={13} weight="bold" tintColor="#ffffff" />
                    </Animated.View>
                  ) : (
                    <Text style={styles.roomBadgeNum}>{index + 1}</Text>
                  )}
                </View>
                <Text style={[styles.roomOptionText, hasLatin(option) && latin.semibold]}>
                  {option}
                </Text>
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>

      {reveal ? (
        <Animated.View entering={enterDown}>
          <Panel>
            <Text
              style={[
                styles.verdictText,
                { color: gained ? colors.positiveInk : colors.dangerInk },
              ]}
            >
              {gained ? `答對了 +${gained}` : chosen === null ? "沒有作答" : "答錯了"}
            </Text>
            {reveal.explanation ? <Text style={styles.muted}>{reveal.explanation}</Text> : null}
          </Panel>
        </Animated.View>
      ) : chosen !== null ? (
        <Animated.Text entering={swapIn} style={styles.waitHint}>
          已作答，等其他人…
        </Animated.Text>
      ) : null}

      <Scoreboard hostUid={state.hostUid} players={state.players} title="排名" you={state.you} />

      {host ? (
        <Button
          label="提前結束"
          icon="stop.fill"
          variant="ghost"
          onPress={() => {
            haptics.warning();
            send({ type: "end" });
          }}
        />
      ) : null}
    </View>
  );
}

function RoomPrompt({
  question,
  revealed,
}: {
  question: LiveQuestion;
  revealed: Record<number, string>;
}) {
  if (question.type === "meaning") {
    return (
      <Panel style={styles.centerPrompt}>
        <Text style={styles.roomWordEn}>{question.prompt}</Text>
      </Panel>
    );
  }
  if (question.type === "reverse") {
    return (
      <Panel style={styles.centerPrompt}>
        <Text style={styles.roomWordZh}>{question.prompt}</Text>
      </Panel>
    );
  }
  if (!question.passage) {
    return (
      <Panel>
        <Text style={styles.roomSentence}>{question.prompt}</Text>
      </Panel>
    );
  }
  return (
    <View style={styles.passageWrap}>
      <Panel>
        {question.passage.title ? (
          <Text style={styles.passageTitle}>{question.passage.title}</Text>
        ) : null}
        <Text style={styles.passageText}>
          {passageParts(question.passage.text).map((part, index) =>
            typeof part === "string" ? (
              part
            ) : (
              <Text
                key={index}
                style={[
                  styles.blankInline,
                  part === question.blank
                    ? styles.blankCurrent
                    : revealed[part]
                      ? styles.blankSolved
                      : styles.blankIdle,
                ]}
              >
                {revealed[part] && part !== question.blank ? ` ${revealed[part]} ` : ` (${part}) `}
              </Text>
            ),
          )}
        </Text>
      </Panel>
      {question.type === "reading" ? (
        <Text style={styles.readingQ}>{question.prompt}</Text>
      ) : (
        <Text style={styles.muted}>選出第 {question.blank} 格的答案</Text>
      )}
    </View>
  );
}

function EndedView({ state }: { state: RoomState }) {
  const place = state.players.findIndex((player) => player.uid === state.you) + 1;
  const myScore = state.players.find((player) => player.uid === state.you)?.score ?? 0;
  const review = state.review;

  useEffect(() => {
    haptics.success();
  }, []);

  return (
    <View style={styles.section}>
      <View style={styles.endedHero}>
        <Text style={styles.endedSub}>對戰結束</Text>
        <Text style={styles.endedRank}>{place ? `第 ${place} 名` : "完成"}</Text>
        <Text style={styles.endedScore}>{myScore} 分</Text>
      </View>

      <Scoreboard
        hostUid={state.hostUid}
        players={state.players}
        title="最終排名"
        you={state.you}
      />

      {review?.items.length ? (
        <ListGroup title={`答錯或沒答的 ${review.items.length} 題`}>
          {review.items.map((item) => {
            const passage = item.question.passageId
              ? review.passages[item.question.passageId]
              : undefined;
            const prompt =
              item.question.prompt ||
              (passage ? `${passage.title || "短文"} 第 ${item.question.blank} 格` : "");
            const rightText = item.accepted.map((i) => item.question.options[i]).join(" / ");
            const choiceText =
              item.choice !== null
                ? ` · 你選：${item.question.options[item.choice]}`
                : " · 沒有作答";
            return (
              <ListRow
                key={item.index}
                title={prompt}
                latinTitle
                subtitle={`正解：${rightText}${choiceText}${item.explanation ? `\n${item.explanation}` : ""}`}
              />
            );
          })}
        </ListGroup>
      ) : review ? (
        <Text style={styles.perfectText}>全部答對，太強了。</Text>
      ) : null}

      <Button label="再開一場" icon="bolt.shield.fill" size="lg" onPress={() => router.back()} />
    </View>
  );
}

function Scoreboard({
  players,
  you,
  hostUid,
  title,
}: {
  players: RoomPlayer[];
  you: string;
  hostUid: string;
  title: string;
}) {
  return (
    <ListGroup title={title}>
      {players.map((player, index) => (
        <Animated.View key={player.uid} layout={glide}>
          <ListRow
            title={`${index + 1}.  ${player.name}${player.uid === you ? "（你）" : ""}`}
            subtitle={!player.connected ? "離線" : player.answered ? "已作答" : undefined}
            icon={player.uid === hostUid ? "crown.fill" : "person.fill"}
            iconTint={player.uid === hostUid ? colors.highlight : colors.inkMuted}
            detail={String(player.score)}
          />
        </Animated.View>
      ))}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  column: { flex: 1, width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: space.gutter,
    paddingVertical: 10,
  },
  scrollContent: { paddingHorizontal: space.gutter, paddingTop: 6 },
  loader: { paddingVertical: 80, alignItems: "center", gap: 12 },
  loaderText: { ...type.body, color: colors.inkMuted },
  section: { gap: 16 },
  liveWrap: { gap: 16 },
  lobbyCard: { alignItems: "center", paddingVertical: 28, gap: 14 },
  bigCode: { ...latin.heavy, fontSize: 44, letterSpacing: 8, color: colors.ink },
  lobbyBtns: { flexDirection: "row", gap: 10 },
  muted: { ...type.hint, color: colors.inkMuted },
  waitHint: { ...type.hint, color: colors.inkMuted, paddingHorizontal: 4 },
  liveMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  answeredMeta: { ...latin.medium, fontSize: 13, color: colors.inkMuted, marginLeft: "auto" },
  centerPrompt: { alignItems: "center", paddingVertical: 28 },
  roomWordEn: {
    ...latin.bold,
    fontSize: 38,
    letterSpacing: -1,
    color: colors.ink,
    textAlign: "center",
  },
  roomWordZh: { fontSize: 30, fontWeight: "700", color: colors.ink, textAlign: "center" },
  roomSentence: { ...latin.medium, fontSize: 19, lineHeight: 28, color: colors.ink },
  passageWrap: { gap: 10 },
  passageTitle: { ...latin.bold, fontSize: 17, color: colors.ink },
  passageText: { ...latin.medium, fontSize: 16, lineHeight: 27, color: colors.ink },
  blankInline: { ...latin.semibold },
  blankCurrent: { backgroundColor: colors.contrast, color: colors.onContrast },
  blankSolved: { backgroundColor: colors.positiveSoft, color: colors.positiveInk },
  blankIdle: { backgroundColor: colors.surfaceRaised, color: colors.inkMuted },
  readingQ: {
    ...latin.semibold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.ink,
    paddingHorizontal: 4,
  },
  optionList: { gap: 8 },
  roomOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  roomOptionPicked: { borderColor: colors.contrast, backgroundColor: colors.accentSoft },
  roomOptionRight: { borderColor: colors.positive, backgroundColor: colors.positiveSoft },
  roomOptionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  roomTone: { borderRadius: radius.tile, borderWidth: 1.5 },
  roomBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  roomBadgeTone: { borderRadius: 14 },
  roomBadgeRight: { backgroundColor: "#1f9d55" },
  roomBadgeWrong: { backgroundColor: "#d2445f" },
  roomBadgeNum: { ...latin.semibold, fontSize: 13, color: colors.inkMuted },
  roomOptionText: { fontSize: 16, color: colors.ink, flex: 1 },
  verdictText: { fontSize: 17, fontWeight: "700" },
  endedHero: {
    backgroundColor: colors.heroBg,
    borderRadius: radius.hero,
    borderCurve: "continuous",
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 6,
  },
  endedSub: { fontSize: 14, color: colors.heroMuted },
  endedRank: { fontSize: 38, fontWeight: "800", color: colors.heroText },
  endedScore: { ...latin.semibold, fontSize: 16, color: colors.heroMuted },
  perfectText: { ...type.body, fontWeight: "600", color: colors.positiveInk, paddingHorizontal: 4 },
});
