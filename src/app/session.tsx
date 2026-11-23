import { useQueries } from "@tanstack/react-query";
import { router } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { SymbolView } from "expo-symbols";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomAnswer } from "@/components/practice/custom-answer";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { DescriptionPoints } from "@/components/ui/description-points";
import {
  CONTENT_MAX_WIDTH,
  EmptyState,
  SPLIT_MAX_WIDTH,
  useSplitView,
} from "@/components/ui/layout";
import { PressableScale } from "@/components/ui/pressable-scale";
import { ProgressBar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { SheetHeader } from "@/components/ui/sheet-header";
import { SpeakButton } from "@/components/ui/speak-button";
import { StarButton } from "@/components/ui/star-button";
import {
  calendarDay,
  descriptionPoints,
  normalizeWord,
  type PracticeTask,
} from "@/core/contract";
import {
  isCustomStep,
  isRight,
  rightAnswerText,
  type Choice,
  type CustomStep,
} from "@/core/domain/custom";
import { TASK_LABELS } from "@/core/domain/labels";
import {
  isMarked,
  optionWord,
  promptWord,
  wordIndex,
  type SetWord,
} from "@/core/domain/marks";
import { passageParts, type PracticeItem, type Step } from "@/core/domain/practice";
import {
  acceptTyped,
  advance,
  choose,
  currentStep,
  finished,
  newRound,
  result,
  usedBankOptions,
  type Round,
} from "@/core/domain/round";
import { errorMessage } from "@/data/api";
import { recordAnswer } from "@/data/learning";
import { starWords } from "@/data/library";
import { setQuery } from "@/data/queries";
import { clearRound, loadRound, saveRound } from "@/data/round-store";
import { haptics } from "@/lib/haptics";
import { colors, hasLatin, latin, radius, space, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

interface Marks {
  words: Map<string, SetWord>;
  marked: string[];
  mark: (word: string, on: boolean) => void;
}
const MarksContext = createContext<Marks>({ words: new Map(), marked: [], mark: () => {} });

const kindLabel = (item: PracticeItem) =>
  item.kind === "custom" ? item.label : TASK_LABELS[item.kind as PracticeTask];

function useSetWords(setIds: string[]) {
  const contents = useQueries({
    queries: setIds.map((id) => setQuery(id, true)),
  });
  const stamp = contents.map((query) => query.dataUpdatedAt).join();
  return useMemo(
    () => wordIndex(contents.flatMap((query) => (query.data ? [query.data] : []))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stamp],
  );
}

function MarkStar({ word }: { word: string }) {
  const { words, marked, mark } = useContext(MarksContext);
  const entry = words.get(normalizeWord(word));
  const starred = entry ? entry.starred : isMarked(marked, word);

  return (
    <StarButton
      word={word}
      starred={starred}
      size={19}
      onToggle={() => {
        mark(word, !starred);
        if (entry) {
          starWords(entry.setId, [entry.wordId], !starred).catch((reason) => {
            mark(word, starred);
            haptics.error();
            toast.error(errorMessage(reason));
          });
        }
      }}
    />
  );
}

export default function SessionScreen() {
  const [round, setRound] = useState<Round | null>(loadRound);
  const headerHeight = useHeaderHeight();

  useEffect(() => {
    if (round && !finished(round)) saveRound(round);
  }, [round]);

  const latest = useRef(round);
  useLayoutEffect(() => {
    latest.current = round;
  }, [round]);

  const typed = (current: Round) => {
    const step = currentStep(current);
    return Boolean(step && isCustomStep(step) && step.mode === "input");
  };

  const record = (current: Round, correct: boolean) => {
    const item = current.items[current.index];
    const step = item.steps[current.step];
    recordAnswer({
      senseId: step.senseId,
      wordId: step.wordId,
      task: item.kind as PracticeTask,
      correct,
      day: calendarDay(new Date()),
    });
  };

  const pick = useCallback((option: Choice | null) => {
    const current = latest.current;
    if (!current || current.revealed || finished(current)) return;
    const step = currentStep(current)!;
    const right = isRight(step, option);
    if (right) haptics.success();
    else if (option === null) haptics.tap();
    else haptics.error();
    if (!typed(current)) record(current, right);
    const nextRound = choose(current, option);
    latest.current = nextRound;
    setRound(nextRound);
  }, []);

  const next = useCallback(() => {
    const current = latest.current;
    if (!current || !current.revealed) return;
    haptics.tap();
    if (typed(current)) {
      record(
        current,
        isRight(currentStep(current)!, current.choices[current.index][current.step]),
      );
    }
    const advanced = advance(current);
    latest.current = advanced;
    setRound(advanced);
  }, []);

  const accept = useCallback(() => {
    haptics.success();
    setRound((current) => (current ? acceptTyped(current) : current));
  }, []);

  const words = useSetWords(round?.setIds ?? []);
  const mark = useCallback((word: string, on: boolean) => {
    setRound((current) => {
      if (!current) return current;
      const rest = (current.marked ?? []).filter(
        (entry) => normalizeWord(entry) !== normalizeWord(word),
      );
      return { ...current, marked: on ? [...rest, word] : rest };
    });
  }, []);

  const marks = useMemo(
    () => ({ words, marked: round?.marked ?? [], mark }),
    [words, round?.marked, mark],
  );

  if (!round) {
    return (
      <View style={[styles.root, { paddingTop: headerHeight, paddingHorizontal: space.gutter }]}>
        <SheetHeader title="練習" />
        <EmptyState
          icon="play.circle"
          title="沒有進行中的練習"
          action={<Button label="返回" variant="secondary" onPress={() => router.back()} />}
        />
      </View>
    );
  }

  return (
    <MarksContext.Provider value={marks}>
      <SheetHeader
        title={finished(round) ? "" : `${round.index + 1} / ${round.items.length}`}
        closeLabel="離開練習（進度會保留）"
      />
      {finished(round) ? (
        <ResultsView
          round={round}
          onAgain={(items) => {
            haptics.confirm();
            const again = newRound(items, round.setIds);
            saveRound(again);
            setRound(again);
          }}
        />
      ) : (
        <PracticeCard round={round} pick={pick} next={next} accept={accept} />
      )}
    </MarksContext.Provider>
  );
}

function PracticeCard({
  round,
  pick,
  next,
  accept,
}: {
  round: Round;
  pick: (option: Choice | null) => void;
  next: () => void;
  accept: () => void;
}) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const split = useSplitView();
  const item = round.items[round.index];
  const step = currentStep(round)!;
  const chosen = round.choices[round.index][round.step];
  const used = usedBankOptions(round);
  const progress = (round.index + (round.revealed ? 1 : 0)) / round.items.length;
  const last = round.index + 1 === round.items.length && round.step + 1 === item.steps.length;

  const hasPassage =
    ("passage" in item && Boolean(item.passage)) ||
    (item.kind === "custom" && Boolean(item.passage));
  const useTwoCols = split && hasPassage;

  const promptCard = (
    <View style={styles.promptCard}>
      <Text style={styles.kindBadge}>
        {kindLabel(item)}
        {item.steps.length > 1 ? ` · ${round.step + 1}/${item.steps.length}` : ""}
      </Text>
      {item.kind === "custom" ? (
        <CustomPromptView item={item} step={step as CustomStep} />
      ) : (
        <PromptView
          item={item}
          step={step as Step}
          round={round}
          chosen={chosen as number | null | undefined}
        />
      )}
    </View>
  );

  const answerBlock = (
    <Animated.View key={`${round.index}-${round.step}`} entering={FadeIn.duration(180)}>
      {isCustomStep(step) && step.mode !== "single" ? (
        <View style={styles.customBox}>
          <CustomAnswer step={step} chosen={chosen} revealed={round.revealed} submit={pick} />
        </View>
      ) : (
        <OptionsGrid
          step={step as Step}
          chosen={chosen as number | null | undefined}
          revealed={round.revealed}
          used={used}
          pick={pick}
        />
      )}
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.root, { paddingTop: headerHeight }]}
    >
      <View
        style={[
          styles.column,
          { maxWidth: useTwoCols ? SPLIT_MAX_WIDTH : CONTENT_MAX_WIDTH },
        ]}
      >
        {/* Top Progress Header */}
        <View style={styles.topBar}>
          <View style={styles.progressWrap}>
            <ProgressBar value={progress} />
          </View>
        </View>

        {/* Main Content */}
        <Animated.View
          key={round.index}
          entering={FadeInRight.duration(240)}
          style={styles.stage}
        >
          {useTwoCols ? (
            <View style={styles.splitRow}>
              <ScrollView
                style={styles.splitLeft}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {promptCard}
              </ScrollView>
              <ScrollView
                style={styles.splitRight}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {answerBlock}
              </ScrollView>
            </View>
          ) : (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {promptCard}
              {answerBlock}
            </ScrollView>
          )}

          {/* Bottom Feedback or Skip */}
          {round.revealed ? (
            <FeedbackCard
              item={item}
              step={step}
              chosen={chosen}
              accept={accept}
              bottomInset={insets.bottom}
              action={
                <Button
                  label={last ? "看結果" : "下一題"}
                  trailingIcon={last ? "flag.checkered" : "arrow.right"}
                  variant="solid"
                  size="lg"
                  onPress={next}
                  style={styles.nextBtn}
                />
              }
            />
          ) : (
            <View style={[styles.skipBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Pressable
                hitSlop={10}
                onPress={() => pick(null)}
                style={styles.skipBtn}
              >
                <Text style={styles.skipText}>不會，看答案</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

function PromptView({
  item,
  step,
  round,
  chosen,
}: {
  item: PracticeItem;
  step: Step;
  round: Round;
  chosen: number | null | undefined;
}) {
  if (item.kind === "meaning" || item.kind === "reverse") {
    return (
      <View style={styles.wordPrompt}>
        <Text
          style={item.kind === "meaning" ? styles.headwordEn : styles.headwordZh}
          adjustsFontSizeToFit
          numberOfLines={3}
        >
          {item.kind === "meaning" ? item.word : item.sense.meaning}
        </Text>
        <View style={styles.wordPromptFoot}>
          <Text style={styles.posText}>{item.sense.pos}</Text>
          <View style={styles.wordPromptTools}>
            {item.kind === "meaning" ? <SpeakButton text={item.word} /> : null}
            {item.kind === "meaning" || round.revealed ? <MarkStar word={item.word} /> : null}
          </View>
        </View>
      </View>
    );
  }

  if (item.kind === "vocabulary") {
    const [before, after] = step.prompt.split("_____");
    const filled = round.revealed ? step.options[step.answer] : null;
    return (
      <Text style={styles.sentencePrompt}>
        {before}
        <Text style={filled ? styles.sentenceFilled : styles.sentenceBlank}>
          {filled ? ` ${filled} ` : "  _____  "}
        </Text>
        {after}
      </Text>
    );
  }

  if (!("passage" in item) || item.kind === "custom") return null;
  const steps = item.steps;
  const answers = round.choices[round.index];

  return (
    <View style={styles.passageBlock}>
      {item.title ? <Text style={styles.passageTitle}>{item.title}</Text> : null}
      <Text style={styles.passageText}>
        {passageParts(item.passage).map((part, index) => {
          if (typeof part === "string") return part;
          const at = steps.findIndex((entry) => entry.blank === part);
          const done = at < round.step || (at === round.step && round.revealed);
          const picked = done ? answers[at] : undefined;
          const right = done && picked === steps[at].answer;
          const active = at === round.step && !round.revealed;
          return (
            <Text
              key={index}
              style={[
                styles.passageBlank,
                active
                  ? styles.passageBlankActive
                  : done
                    ? right
                      ? styles.passageBlankRight
                      : styles.passageBlankWrong
                    : styles.passageBlankIdle,
              ]}
            >
              {done
                ? right
                  ? ` ${steps[at].options[steps[at].answer]} `
                  : ` (${part}) ${steps[at].options[steps[at].answer]} `
                : ` (${part}) `}
            </Text>
          );
        })}
      </Text>
      {item.kind === "reading" ? (
        <View style={styles.readingQuestion}>
          <Text style={styles.readingPrompt}>{step.prompt}</Text>
        </View>
      ) : null}
      {chosen === undefined && item.kind !== "reading" ? (
        <Text style={styles.blankHint}>選出第 {step.blank} 格的答案</Text>
      ) : null}
    </View>
  );
}

function CustomPromptView({
  item,
  step,
}: {
  item: Extract<PracticeItem, { kind: "custom" }>;
  step: CustomStep;
}) {
  return (
    <View style={styles.passageBlock}>
      {item.instructions ? <Text style={styles.instructions}>{item.instructions}</Text> : null}
      {item.passage ? (
        <View style={styles.customPassageBox}>
          <Text style={styles.passageText}>{item.passage}</Text>
        </View>
      ) : null}
      <Text style={[styles.sentencePrompt, !hasLatin(step.prompt) && styles.zhPrompt]}>
        {step.prompt}
      </Text>
    </View>
  );
}

function OptionsGrid({
  step,
  chosen,
  revealed,
  used,
  pick,
}: {
  step: Pick<Step, "options" | "answer" | "glosses" | "poses">;
  chosen: number | null | undefined;
  revealed: boolean;
  used: Set<number>;
  pick: (option: number) => void;
}) {
  const wide =
    step.options.length > 4 || step.options.some((option) => option.length > 18);

  return (
    <View style={[styles.optionsWrap, !wide && styles.optionsGrid]}>
      {step.options.map((option, index) => (
        <OptionTile
          key={index}
          index={index}
          option={option}
          wide={wide}
          right={revealed && index === step.answer}
          wrong={revealed && index === chosen && chosen !== step.answer}
          used={!revealed && used.has(index)}
          revealed={revealed}
          gloss={revealed ? step.glosses?.[index] : undefined}
          pos={revealed ? step.poses?.[index] : undefined}
          starWord={revealed ? optionWord(step as Step, index) : undefined}
          onPick={() => pick(index)}
        />
      ))}
    </View>
  );
}

function OptionTile({
  index,
  option,
  wide,
  right,
  wrong,
  used,
  revealed,
  gloss,
  pos,
  starWord,
  onPick,
}: {
  index: number;
  option: string;
  wide: boolean;
  right: boolean;
  wrong: boolean;
  used: boolean;
  revealed: boolean;
  gloss?: string;
  pos?: string;
  starWord?: string;
  onPick: () => void;
}) {
  const shake = useSharedValue(0);
  useEffect(() => {
    if (wrong) {
      shake.set(
        withSequence(
          withTiming(-7, { duration: 45 }),
          withTiming(7, { duration: 55 }),
          withTiming(-4, { duration: 50 }),
          withTiming(0, { duration: 50 }),
        ),
      );
    }
  }, [wrong, shake]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  return (
    <Animated.View style={[wide ? styles.optionFull : styles.optionHalf, shakeStyle]}>
      <PressableScale
        scaleTo={0.97}
        disabled={revealed || used}
        onPress={onPick}
        style={[
          styles.optionTile,
          wide ? styles.optionTileWide : styles.optionTileSquare,
          right && styles.optionRight,
          wrong && styles.optionWrong,
          used && styles.optionUsed,
        ]}
      >
        <View style={styles.optionTopRow}>
          <View
            style={[
              styles.optionBadge,
              (right || wrong) && styles.optionBadgeClear,
            ]}
          >
            {right ? (
              <SymbolView name="checkmark" size={14} weight="bold" tintColor={colors.positiveInk} />
            ) : wrong ? (
              <SymbolView name="xmark" size={14} weight="bold" tintColor={colors.dangerInk} />
            ) : (
              <Text style={styles.optionNum}>{index + 1}</Text>
            )}
          </View>
          {!wide && starWord ? (
            <View style={styles.optionStarCorner}>
              <MarkStar word={starWord} />
            </View>
          ) : null}
        </View>

        <View style={[styles.optionCopy, wide && styles.optionCopyWide]}>
          <Text
            style={[
              styles.optionLabel,
              hasLatin(option) && latin.semibold,
              right && styles.optionLabelRight,
              wrong && styles.optionLabelWrong,
            ]}
          >
            {option}
          </Text>
          {gloss ? (
            <Text style={styles.glossText} numberOfLines={2}>
              {pos ? <Text style={latin.medium}>{pos} </Text> : null}
              <Text style={hasLatin(gloss) ? latin.medium : undefined}>{gloss}</Text>
            </Text>
          ) : null}
        </View>

        {wide && starWord ? <MarkStar word={starWord} /> : null}
      </PressableScale>
    </Animated.View>
  );
}

function reasonsFor(
  step: Step | CustomStep,
  chosen: Choice | null | undefined,
): { option: string; reason: string; picked: boolean }[] {
  if (isCustomStep(step) && step.mode !== "single" && step.mode !== "multiple") return [];
  const picked = new Set(
    typeof chosen === "number"
      ? [chosen]
      : Array.isArray(chosen) && isCustomStep(step) && step.mode === "multiple"
        ? chosen
        : [],
  );
  return step.options
    .map((option, index) => ({
      option,
      reason: step.whyWrong?.[option],
      picked: picked.has(index),
    }))
    .filter((entry): entry is { option: string; reason: string; picked: boolean } =>
      Boolean(entry.reason),
    )
    .sort((a, b) => Number(b.picked) - Number(a.picked));
}

function hasExplanation(
  item: PracticeItem,
  step: Step | CustomStep,
  chosen: Choice | null | undefined,
) {
  if (item.kind === "meaning" || item.kind === "reverse") {
    return Boolean(item.sense.examples[0]) || descriptionPoints(item.sense.description).length > 0;
  }
  return Boolean(step.explanation) || reasonsFor(step, chosen).length > 0;
}

function ExplanationBlock({
  item,
  step,
  chosen,
}: {
  item: PracticeItem;
  step: Step | CustomStep;
  chosen: Choice | null | undefined;
}) {
  const reasons = reasonsFor(step, chosen);
  const wordTask = item.kind === "meaning" || item.kind === "reverse";
  const example = wordTask ? item.sense.examples[0] : undefined;
  const notes = wordTask ? descriptionPoints(item.sense.description) : [];

  return (
    <View style={styles.expBlock}>
      {example ? (
        <View style={styles.expExample}>
          <Text style={styles.expExampleText}>{example}</Text>
          <SpeakButton text={example} compact size={15} />
        </View>
      ) : null}
      {notes.length > 0 ? <DescriptionPoints points={notes} /> : null}
      {step.explanation && !wordTask ? (
        <Text style={styles.expText}>{step.explanation}</Text>
      ) : null}
      {reasons.length > 0 ? (
        <View style={styles.reasonsList}>
          {reasons.map(({ option, reason, picked }) => (
            <Text key={option} style={styles.reasonLine}>
              <Text
                style={[
                  styles.reasonOption,
                  hasLatin(option) && latin.semibold,
                  picked && { color: colors.dangerInk },
                ]}
              >
                {option}
              </Text>
              <Text style={styles.expText}>：{reason}</Text>
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FeedbackCard({
  item,
  step,
  chosen,
  accept,
  bottomInset,
  action,
}: {
  item: PracticeItem;
  step: Step | CustomStep;
  chosen: Choice | null | undefined;
  accept: () => void;
  bottomInset: number;
  action: ReactNode;
}) {
  const right = isRight(step, chosen);
  const typedWrong =
    !right && typeof chosen === "string" && isCustomStep(step) && step.mode === "input";
  const answer = rightAnswerText(step);

  return (
    <Animated.View
      entering={FadeInDown.duration(240)}
      style={[styles.feedbackCard, { paddingBottom: Math.max(bottomInset, 14) }]}
    >
      <ScrollView
        style={styles.feedbackScroll}
        contentContainerStyle={styles.feedbackInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.feedbackHead}>
          <SymbolView
            name={right ? "checkmark" : "xmark"}
            size={18}
            weight="bold"
            tintColor={right ? colors.positiveInk : colors.dangerInk}
          />
          <Text style={styles.feedbackTitle}>
            {right ? (
              "答對了"
            ) : (
              <>
                正確答案是{" "}
                <Text style={hasLatin(answer) ? latin.bold : undefined}>{answer}</Text>
              </>
            )}
          </Text>
          {typedWrong ? (
            <Button label="我其實答對了" size="sm" variant="ghost" onPress={accept} />
          ) : null}
        </View>
        {typedWrong &&
        isCustomStep(step) &&
        step.mode === "input" &&
        step.accepted.length > 1 ? (
          <Text style={styles.acceptedAlt}>{step.accepted.join(" / ")}</Text>
        ) : null}
        <ExplanationBlock item={item} step={step} chosen={chosen} />
      </ScrollView>
      {action}
    </Animated.View>
  );
}

// ---- Round Results & Review ----

function answeredText(step: Step | CustomStep, choice: Choice | null | undefined): string {
  if (choice === null || choice === undefined) return "沒作答";
  if (typeof choice === "string") return choice;
  const options =
    !isCustomStep(step) || step.mode === "single" || step.mode === "multiple"
      ? step.options
      : [];
  return (Array.isArray(choice) ? choice : [choice]).map((i) => options[i]).join("、");
}

function pickedGloss(
  step: Step | CustomStep,
  choice: Choice | null | undefined,
): string | undefined {
  return typeof choice === "number" && !isCustomStep(step) ? step.glosses?.[choice] : undefined;
}

function formatDuration(from: string, to: number) {
  const seconds = Math.max(0, Math.round((to - Date.parse(from)) / 1000));
  if (seconds >= 3600) {
    return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type ReviewFilter = "missed" | "starred" | "all";

function ResultsView({
  round,
  onAgain,
}: {
  round: Round;
  onAgain: (items: PracticeItem[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const outcome = useMemo(() => result(round), [round]);
  const { words, marked } = useContext(MarksContext);
  const [endedAt] = useState(() => Date.now());

  useEffect(() => {
    clearRound();
    haptics.success();
  }, []);

  const score = outcome.total ? Math.round((outcome.correct / outcome.total) * 100) : 0;
  const wrong = outcome.total - outcome.correct;
  const [filter, setFilter] = useState<ReviewFilter>(wrong ? "missed" : "all");

  const steps = useMemo(
    () =>
      round.items.flatMap((item, index) =>
        (item.steps as (Step | CustomStep)[]).map((step, at) => ({
          item,
          step,
          key: `${index}-${at}`,
          at,
          choice: round.choices[index]?.[at],
        })),
      ),
    [round],
  );

  const shown =
    filter === "missed"
      ? steps.filter((entry) => !isRight(entry.step, entry.choice))
      : steps;

  const filterOptions: { value: ReviewFilter; label: string }[] = [
    ...(wrong ? [{ value: "missed" as const, label: `答錯 ${wrong}` }] : []),
    ...(marked.length ? [{ value: "starred" as const, label: `標星 ${marked.length}` }] : []),
    { value: "all", label: `全部 ${steps.length}` },
  ];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.resultsContent,
        {
          paddingTop: headerHeight + 16,
          paddingBottom: Math.max(insets.bottom, 24) + 16,
        },
      ]}
    >
      <View style={styles.resultsColumn}>
        <View style={styles.resultHero}>
          <Text style={styles.resultLabel}>這一輪完成了</Text>
          <View style={styles.resultScoreRow}>
            <AnimatedNumber value={score} style={styles.resultBig} />
            <Text style={styles.resultPercent}>%</Text>
          </View>

          <View style={styles.statRow}>
            {[
              ["答對", String(outcome.correct)],
              ["答錯", String(wrong)],
              ["標星", String(marked.length)],
              ["用時", formatDuration(round.startedAt, endedAt)],
            ].map(([label, val]) => (
              <View key={label} style={styles.statItem}>
                <Text style={styles.statVal}>{val}</Text>
                <Text style={styles.statLbl}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.resultActions}>
            {outcome.missed.length > 0 ? (
              <Button
                label={`再練錯的 ${outcome.missed.length} 題`}
                icon="arrow.counterclockwise"
                variant="hero"
                size="lg"
                onPress={() => onAgain(outcome.missed)}
                style={styles.retryBtn}
              />
            ) : null}
            <Button
              label="完成"
              trailingIcon="arrow.right"
              variant={outcome.missed.length > 0 ? "heroGhost" : "hero"}
              size="lg"
              onPress={() => router.replace("/(tabs)/today")}
              style={outcome.missed.length > 0 ? styles.doneBtn : styles.doneFullBtn}
            />
          </View>
        </View>

        <Segmented<ReviewFilter>
          value={filter}
          onChange={setFilter}
          options={filterOptions}
        />

        {filter === "starred" ? (
          <View style={styles.starredCard}>
            {marked.map((word, index) => {
              const entry = words.get(normalizeWord(word));
              return (
                <View
                  key={word}
                  style={[styles.starredItem, index > 0 && styles.starredDivider]}
                >
                  <Text style={styles.starredWord}>{entry?.word ?? word}</Text>
                  <Text style={styles.starredMeaning} numberOfLines={1}>
                    {entry ? entry.meaning : "不在單字集，離開後不保留"}
                  </Text>
                  <MarkStar word={word} />
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.reviewList}>
            {shown.map(({ item, step, key, at, choice }) => (
              <ReviewCard key={key} item={item} step={step} at={at} choice={choice} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function ReviewCard({
  item,
  step,
  at,
  choice,
}: {
  item: PracticeItem;
  step: Step | CustomStep;
  at: number;
  choice: Choice | null | undefined;
}) {
  const right = isRight(step, choice);
  const answer = rightAnswerText(step);
  const word = promptWord(item, step);
  const wordTask = item.kind === "meaning" || item.kind === "reverse";
  const title = wordTask
    ? item.word
    : step.prompt || `${kindLabel(item)} 第 ${at + 1} 格`;
  const answered = answeredText(step, choice);
  const picked = pickedGloss(step, choice);
  const explained = hasExplanation(item, step, choice);
  const [open, setOpen] = useState(!right);

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewTop}>
        <SymbolView
          name={right ? "checkmark" : "xmark"}
          size={16}
          weight="bold"
          tintColor={right ? colors.positiveInk : colors.dangerInk}
          style={styles.reviewMark}
        />
        <Pressable
          disabled={!explained}
          onPress={() => {
            haptics.tap();
            setOpen((v) => !v);
          }}
          style={styles.reviewTitleBtn}
        >
          <Text
            style={[
              styles.reviewTitle,
              (wordTask || hasLatin(title)) && latin.semibold,
            ]}
          >
            {title.replace("_____", "＿＿")}
            {wordTask ? <Text style={styles.reviewPos}>  {item.sense.pos}</Text> : null}
          </Text>
        </Pressable>
        {word ? <MarkStar word={word} /> : null}
      </View>

      <View style={styles.reviewDetail}>
        <Text
          style={[
            styles.reviewAnswer,
            !wordTask && styles.reviewAnswerRight,
            !wordTask && hasLatin(answer) && latin.semibold,
          ]}
        >
          {wordTask ? item.sense.meaning : answer}
        </Text>
        {!right ? (
          <Text style={styles.reviewWrong}>
            你的答案：
            <Text style={hasLatin(answered) ? latin.semibold : undefined}>{answered}</Text>
            {picked ? (
              <Text style={styles.reviewGloss}>
                {" — 那是 "}
                <Text style={hasLatin(picked) ? latin.medium : undefined}>{picked}</Text>
              </Text>
            ) : null}
          </Text>
        ) : null}
        {open && explained ? (
          <View style={styles.reviewExpWrap}>
            <ExplanationBlock item={item} step={step} chosen={choice} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  column: { flex: 1, width: "100%", alignSelf: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: space.gutter,
    paddingTop: 8,
    paddingBottom: 10,
  },
  progressWrap: { flex: 1 },
  stage: { flex: 1 },
  scrollContent: {
    paddingHorizontal: space.gutter,
    paddingTop: 6,
    paddingBottom: 20,
    gap: 12,
    flexGrow: 1,
  },
  splitRow: { flex: 1, flexDirection: "row", gap: 8 },
  splitLeft: { flex: 1.15 },
  splitRight: { flex: 1 },
  promptCard: {
    flexGrow: 1,
    minHeight: 190,
    backgroundColor: colors.surface,
    borderRadius: radius.hero,
    borderCurve: "continuous",
    padding: 20,
    gap: 14,
  },
  kindBadge: {
    ...type.hint,
    fontWeight: "500",
    color: colors.inkMuted,
  },
  wordPrompt: {
    marginTop: "auto",
    gap: 12,
  },
  headwordEn: {
    ...latin.semibold,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.2,
    color: colors.ink,
  },
  headwordZh: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "700",
    color: colors.ink,
  },
  wordPromptFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  posText: { ...latin.medium, fontSize: 15, color: colors.inkMuted },
  wordPromptTools: { flexDirection: "row", alignItems: "center", gap: 6 },
  sentencePrompt: {
    ...latin.medium,
    fontSize: 20,
    lineHeight: 31,
    color: colors.ink,
  },
  zhPrompt: { fontWeight: "600" },
  sentenceBlank: {
    ...latin.bold,
    color: colors.ink,
    backgroundColor: colors.surfaceRaised,
  },
  sentenceFilled: {
    ...latin.bold,
    color: colors.positiveInk,
    backgroundColor: colors.positiveSoft,
  },
  passageBlock: { gap: 12 },
  passageTitle: { ...latin.bold, fontSize: 18, color: colors.ink },
  passageText: { ...latin.medium, fontSize: 16, lineHeight: 28, color: colors.ink },
  passageBlank: { ...latin.semibold, fontSize: 15 },
  passageBlankActive: { backgroundColor: colors.heroBg, color: colors.heroText },
  passageBlankRight: { backgroundColor: colors.positiveSoft, color: colors.positiveInk },
  passageBlankWrong: { backgroundColor: colors.dangerSoft, color: colors.dangerInk },
  passageBlankIdle: { backgroundColor: colors.surfaceRaised, color: colors.inkMuted },
  readingQuestion: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 12,
  },
  readingPrompt: { ...latin.semibold, fontSize: 17, lineHeight: 25, color: colors.ink },
  blankHint: { ...type.hint, color: colors.inkMuted },
  instructions: { ...type.body, color: colors.inkMuted },
  customPassageBox: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    padding: 14,
  },
  customBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.hero,
    borderCurve: "continuous",
    padding: 14,
  },
  optionsWrap: { gap: 8 },
  optionsGrid: { flexDirection: "row", flexWrap: "wrap" },
  optionHalf: { width: "48.8%", flexGrow: 1 },
  optionFull: { width: "100%" },
  optionTile: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderCurve: "continuous",
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  optionTileSquare: {
    minHeight: 100,
    justifyContent: "space-between",
    gap: 10,
  },
  optionTileWide: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionRight: { backgroundColor: colors.positiveSoft },
  optionWrong: { backgroundColor: colors.dangerSoft },
  optionUsed: { opacity: 0.35 },
  optionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  optionBadgeClear: { borderWidth: 0 },
  optionNum: { ...latin.semibold, fontSize: 12, color: colors.inkMuted },
  optionStarCorner: { margin: -8 },
  optionCopy: { gap: 3 },
  optionCopyWide: { flex: 1 },
  optionLabel: { fontSize: 17, fontWeight: "600", lineHeight: 22, color: colors.ink },
  optionLabelRight: { color: colors.positiveInk },
  optionLabelWrong: { color: colors.dangerInk },
  glossText: { fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  skipBar: {
    alignItems: "center",
    paddingTop: 6,
  },
  skipBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  skipText: { fontSize: 15, fontWeight: "600", color: colors.inkMuted },
  feedbackCard: {
    marginHorizontal: space.gutter - 4,
    backgroundColor: colors.surfaceSolid,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    borderCurve: "continuous",
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 12,
    boxShadow: "0 -6px 28px rgba(17,38,30,0.12)",
  },
  feedbackScroll: { maxHeight: 230 },
  feedbackInner: { gap: 10 },
  feedbackHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  feedbackTitle: { fontSize: 16, fontWeight: "700", color: colors.ink, flex: 1 },
  acceptedAlt: { ...latin.medium, fontSize: 14, color: colors.inkMuted },
  expBlock: { gap: 8 },
  expExample: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 8,
  },
  expExampleText: { ...latin.medium, fontSize: 14, lineHeight: 20, color: colors.ink, flex: 1 },
  expText: { ...type.body, color: colors.inkMuted },
  reasonsList: { gap: 6 },
  reasonLine: { ...type.body },
  reasonOption: { fontWeight: "600", color: colors.ink },
  nextBtn: { width: "100%" },

  // Results styles
  resultsContent: { paddingHorizontal: space.gutter },
  resultsColumn: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    gap: 14,
  },
  resultHero: {
    backgroundColor: colors.heroBg,
    borderRadius: radius.hero,
    borderCurve: "continuous",
    padding: 20,
    gap: 14,
  },
  resultLabel: { fontSize: 14, fontWeight: "500", color: colors.heroMuted },
  resultScoreRow: { flexDirection: "row", alignItems: "baseline" },
  resultBig: { ...type.heroNumber, color: colors.heroText },
  resultPercent: { ...latin.bold, fontSize: 30, color: colors.heroFaint, marginLeft: 2 },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  statItem: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  statVal: { ...latin.bold, fontSize: 16, color: colors.heroText },
  statLbl: { fontSize: 13, color: colors.heroMuted },
  resultActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  retryBtn: { flex: 1.4 },
  doneBtn: { flex: 1 },
  doneFullBtn: { flex: 1 },
  starredCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderCurve: "continuous",
    paddingHorizontal: 14,
  },
  starredItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  starredDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  starredWord: { ...latin.semibold, fontSize: 16, color: colors.ink },
  starredMeaning: { ...type.hint, color: colors.inkMuted, flex: 1, textAlign: "right" },
  reviewList: { gap: 8 },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderCurve: "continuous",
    padding: 15,
    gap: 6,
  },
  reviewTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  reviewMark: { marginTop: 3 },
  reviewTitleBtn: { flex: 1 },
  reviewTitle: { fontSize: 16, lineHeight: 22, color: colors.ink },
  reviewPos: { ...latin.medium, fontSize: 13, color: colors.inkMuted },
  reviewDetail: { paddingLeft: 26, gap: 4 },
  reviewAnswer: { fontSize: 15, fontWeight: "500", color: colors.ink },
  reviewAnswerRight: { color: colors.positiveInk, fontWeight: "600" },
  reviewWrong: { ...type.hint, color: colors.dangerInk },
  reviewGloss: { color: colors.inkMuted },
  reviewExpWrap: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
