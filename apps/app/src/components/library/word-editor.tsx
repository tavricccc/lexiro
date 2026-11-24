import { StyleSheet, View } from "react-native";

import { ActionRow, InputRow, ListGroup, PickerRow, TextBlockRow } from "@/components/ui/list";
import { PARTS_OF_SPEECH, type Word, type WordInput } from "@/core/contract";

export interface SenseDraft {
  key: string;
  id?: string;
  pos: string;
  meaning: string;
  description: string;
  examples: string[];
  supplementary: boolean;
}

export interface WordDraft {
  id?: string;
  word: string;
  starred: boolean;
  senses: SenseDraft[];
}

let keySeed = 0;
const nextKey = () => `draft-${++keySeed}`;

export const emptySense = (): SenseDraft => ({
  key: nextKey(),
  pos: "n.",
  meaning: "",
  description: "",
  examples: [],
  supplementary: false,
});

export const emptyWord = (): WordDraft => ({
  word: "",
  starred: false,
  senses: [emptySense()],
});

export const draftOf = (word: Word): WordDraft => ({
  id: word.id,
  word: word.word,
  starred: word.starred,
  senses: word.senses.map((sense) => ({
    key: sense.id,
    id: sense.id,
    pos: sense.pos,
    meaning: sense.meaning,
    description: sense.description ?? "",
    examples: sense.examples,
    supplementary: sense.supplementary,
  })),
});

export function draftProblem(draft: WordDraft): string | null {
  if (!draft.word.trim()) return "請輸入單字";
  if (!draft.senses.length) return "至少要有一個意思";
  if (draft.senses.some((sense) => !sense.meaning.trim())) return "每個意思都要填中文";
  return null;
}

export function draftInput(draft: WordDraft): WordInput {
  return {
    ...(draft.id ? { id: draft.id } : {}),
    word: draft.word.trim(),
    starred: draft.starred,
    senses: draft.senses.map((sense) => ({
      ...(sense.id ? { id: sense.id } : {}),
      pos: sense.pos,
      meaning: sense.meaning.trim(),
      description: sense.description.trim() || undefined,
      examples: sense.examples.map((example) => example.trim()).filter(Boolean),
      supplementary: sense.supplementary,
    })),
  };
}

const POS_OPTIONS = PARTS_OF_SPEECH.map((pos) => ({ value: pos, label: pos }));

export function WordEditor({
  draft,
  onChange,
  autoFocus = false,
}: {
  draft: WordDraft;
  onChange: (next: WordDraft) => void;
  autoFocus?: boolean;
}) {
  const updateSense = (index: number, change: Partial<SenseDraft>) =>
    onChange({
      ...draft,
      senses: draft.senses.map((sense, at) => (at === index ? { ...sense, ...change } : sense)),
    });

  return (
    <View style={styles.root}>
      <ListGroup title="英文單字">
        <InputRow
          label="單字"
          value={draft.word}
          onChangeText={(word) => onChange({ ...draft, word })}
          placeholder="例如：rescue"
          latinValue
          maxLength={200}
          autoFocus={autoFocus}
        />
      </ListGroup>

      {draft.senses.map((sense, index) => (
        <ListGroup key={sense.key} title={`意思 ${index + 1}`}>
          <PickerRow
            title="詞性"
            value={sense.pos}
            options={POS_OPTIONS}
            onChange={(pos) => updateSense(index, { pos })}
          />
          <InputRow
            label="中文意思"
            value={sense.meaning}
            onChangeText={(meaning) => updateSense(index, { meaning })}
            placeholder="簡短，會當作選項"
            maxLength={200}
          />
          <TextBlockRow
            label="說明（選填）"
            value={sense.description}
            onChangeText={(description) => updateSense(index, { description })}
            placeholder="一行一點，例如用法、搭配詞、相關字形"
            hint="作答後才會顯示。"
            maxLength={2000}
          />
          {sense.examples.map((example, at) => (
            <TextBlockRow
              key={at}
              label={`例句 ${at + 1}`}
              value={example}
              latinValue
              maxLength={500}
              placeholder="輸入英文例句"
              onChangeText={(text) =>
                updateSense(index, {
                  examples: sense.examples.map((value, i) => (i === at ? text : value)),
                })
              }
              onRemove={() =>
                updateSense(index, {
                  examples: sense.examples.filter((_, i) => i !== at),
                })
              }
              removeLabel={`移除例句 ${at + 1}`}
            />
          ))}
          <ActionRow
            title="新增例句"
            icon="plus.circle"
            onPress={() => updateSense(index, { examples: [...sense.examples, ""] })}
          />
          {draft.senses.length > 1 ? (
            <ActionRow
              title="刪除此意思"
              icon="trash"
              destructive
              onPress={() =>
                onChange({
                  ...draft,
                  senses: draft.senses.filter((_, at) => at !== index),
                })
              }
            />
          ) : null}
        </ListGroup>
      ))}

      <ListGroup>
        <ActionRow
          title="再加一個意思"
          icon="plus.circle.fill"
          onPress={() => onChange({ ...draft, senses: [...draft.senses, emptySense()] })}
        />
      </ListGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 18 },
});
