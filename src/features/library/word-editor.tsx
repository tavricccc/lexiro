import { Plus, Trash, X } from "@phosphor-icons/react";
import { PARTS_OF_SPEECH, type Word, type WordInput } from "@lexiro/contract";
import { Button, Field, Input, Panel, Textarea } from "design-kit";
import { LabeledSelect } from "@/ui/labeled-select";

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
const key = () => `draft-${++keySeed}`;
export const emptySense = (): SenseDraft => ({ key: key(), pos: "n.", meaning: "", description: "", examples: [], supplementary: false });
export const emptyWord = (): WordDraft => ({ word: "", starred: false, senses: [emptySense()] });
export const draftOf = (word: Word): WordDraft => ({
  id: word.id,
  word: word.word,
  starred: word.starred,
  senses: word.senses.map((sense) => ({ key: sense.id, id: sense.id, pos: sense.pos, meaning: sense.meaning, description: sense.description ?? "", examples: sense.examples, supplementary: sense.supplementary })),
});

/** The first problem with a draft, or null when it can be saved. */
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

/** A word and its meanings: part of speech, Chinese meaning, notes and examples. */
export function WordEditor({ draft, onChange, autoFocus }: { draft: WordDraft; onChange: (draft: WordDraft) => void; autoFocus?: boolean }) {
  const updateSense = (index: number, change: Partial<SenseDraft>) =>
    onChange({ ...draft, senses: draft.senses.map((sense, at) => (at === index ? { ...sense, ...change } : sense)) });
  return (
    <div className="grid gap-5">
      <Field label="單字">
        {({ id }) => (
          <Input autoCapitalize="none" autoComplete="off" autoFocus={autoFocus} className="font-latin text-lg" id={id} lang="en" maxLength={200} onChange={(event) => onChange({ ...draft, word: event.target.value })} placeholder="例如：rescue" spellCheck={false} value={draft.word} />
        )}
      </Field>
      {draft.senses.map((sense, index) => (
        <Panel className="grid gap-4" key={sense.key}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink-muted">意思 {index + 1}</h3>
            {draft.senses.length > 1 ? (
              <Button aria-label={`移除意思 ${index + 1}`} onClick={() => onChange({ ...draft, senses: draft.senses.filter((_, at) => at !== index) })} size="icon-sm" variant="ghost"><Trash /></Button>
            ) : null}
          </div>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
            <LabeledSelect label="詞性" onChange={(pos) => updateSense(index, { pos })} options={POS_OPTIONS} value={sense.pos} />
            <Field label="中文意思">
              {({ id }) => <Input id={id} maxLength={200} onChange={(event) => updateSense(index, { meaning: event.target.value })} placeholder="簡短，會當作選項" value={sense.meaning} />}
            </Field>
          </div>
          <Field hint="一行一點，例如用法、搭配詞、相關字形。作答後才會顯示。" label="說明（選填）">
            {({ id, describedBy }) => <Textarea aria-describedby={describedBy} className="min-h-24" id={id} maxLength={2000} onChange={(event) => updateSense(index, { description: event.target.value })} value={sense.description} />}
          </Field>
          <div className="grid gap-2">
            <span className="px-1 text-sm font-medium text-ink-muted">例句（選填）</span>
            {sense.examples.map((example, at) => (
              <div className="flex gap-2" key={at}>
                <Input aria-label={`例句 ${at + 1}`} className="font-latin" lang="en" maxLength={500} onChange={(event) => updateSense(index, { examples: sense.examples.map((value, i) => (i === at ? event.target.value : value)) })} value={example} />
                <Button aria-label={`移除例句 ${at + 1}`} onClick={() => updateSense(index, { examples: sense.examples.filter((_, i) => i !== at) })} size="icon" variant="ghost"><X /></Button>
              </div>
            ))}
            <Button className="justify-self-start" onClick={() => updateSense(index, { examples: [...sense.examples, ""] })} size="sm" variant="ghost"><Plus />加例句</Button>
          </div>
        </Panel>
      ))}
      <Button className="justify-self-start" onClick={() => onChange({ ...draft, senses: [...draft.senses, emptySense()] })}><Plus weight="bold" />再加一個意思</Button>
    </div>
  );
}
