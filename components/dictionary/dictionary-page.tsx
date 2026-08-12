"use client";

import type { DictionaryEntry } from "@/types";
import { ArrowLeft, Play, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { dictionaryAudio, dictionaryDefinitions, DictionaryLookupError, lookupDictionary } from "@/src/lib/dictionary";
import { normalizeWordKey } from "@/src/lib/library";

export function DictionaryPage() {
  const { state, saveSet } = useLibraryStore();
  const [word, setWord] = useState("");
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<{ word: string; pos: string; example: string } | null>(null);
  const [targetSets, setTargetSets] = useState<string[]>([]);
  const [meaningZh, setMeaningZh] = useState("");
  const [senseDestination, setSenseDestination] = useState("new");
  const [saved, setSaved] = useState(false);
  const existingWord = adding ? state.words[normalizeWordKey(adding.word)] : undefined;

  const localMatches = useMemo(() => {
    const needle = word.trim().toLocaleLowerCase();
    return needle ? Object.values(state.words).filter((entry) => entry.word.toLocaleLowerCase().includes(needle) || entry.senses.some((sense) => sense.meaningZh.includes(needle) || sense.examples.some((example) => example.toLocaleLowerCase().includes(needle)))) : [];
  }, [state.words, word]);

  const search = async () => {
    setBusy(true); setError("");
    try { setEntries(await lookupDictionary(word)); }
    catch (reason) { setEntries([]); setError(t(reason instanceof DictionaryLookupError && reason.code === "notFound" ? "dictionary.notFound" : "dictionary.unavailable")); }
    finally { setBusy(false); }
  };

  const add = async () => {
    if (!adding || !targetSets.length) return;
    const selectedSense = senseDestination === "new" ? undefined : existingWord?.senses.find((sense) => sense.id === senseDestination);
    if (!selectedSense && !meaningZh.trim()) return;
    for (const targetSet of targetSets) {
      const current = useLibraryStore.getState().state.sets.find((entry) => entry.id === targetSet);
      if (!current) continue;
      const liveState = useLibraryStore.getState().state;
      const existing = (liveState.memberships[targetSet] ?? []).flatMap((membership) => {
        const entry = liveState.words[membership.wordKey];
        return entry ? membership.senseIds.flatMap((senseId) => { const sense = entry.senses.find((item) => item.id === senseId); return sense ? [{ word: entry.word, pos: sense.pos, meaningZh: sense.meaningZh, examples: sense.examples }] : []; }) : [];
      });
      await saveSet({ id: targetSet, setName: current.setName, folderId: current.folderId, words: [...existing, { word: adding.word, pos: selectedSense?.pos ?? adding.pos, meaningZh: selectedSense?.meaningZh ?? meaningZh, examples: adding.example ? [adding.example] : [] }] });
    }
    setAdding(null); setMeaningZh(""); setSenseDestination("new"); setTargetSets([]); setSaved(true);
  };

  return <div><Link href="/library" className="mb-5 inline-flex items-center gap-2 text-sm text-ink-muted"><ArrowLeft className="size-4" />{t("setDetail.back")}</Link><PageHeader title={t("dictionary.title")} description={t("dictionary.description")} />
    <form onSubmit={(event) => { event.preventDefault(); void search(); }} className="flex gap-2"><Input value={word} onChange={(event) => setWord(event.target.value)} placeholder={t("dictionary.search")} /><Button type="submit" disabled={busy}><Search className="size-4" />{busy ? t("dictionary.searching") : t("dictionary.action")}</Button></form>
    {(error || saved) && <div className="mt-5 rounded-2xl bg-brand-soft p-4 text-sm text-brand-strong" role="status">{error || t("dictionary.saved")}</div>}
    {localMatches.length > 0 && <section className="mt-8"><h2 className="text-lg font-semibold">{t("dictionary.localMatches")}</h2><div className="mt-3 divide-y border-y">{localMatches.map((entry) => <div key={entry.wordKey} className="py-4"><b>{entry.word}</b><span className="ml-3 text-sm text-ink-muted">{entry.senses.map((sense) => sense.meaningZh).join("、")}</span></div>)}</div></section>}
    <div className="mt-8 space-y-8">{entries.map((entry, entryIndex) => { const audio = dictionaryAudio(entry); return <section key={`${entry.word}-${entryIndex}`}><div className="flex items-center gap-3"><h2 className="text-3xl font-semibold tracking-[-0.03em]">{entry.word}</h2>{entry.phonetic && <span className="text-ink-muted">{entry.phonetic}</span>}{audio && <Button type="button" size="icon" variant="secondary" aria-label={t("dictionary.playAudio")} onClick={() => void new Audio(audio).play()}><Play className="size-4" /></Button>}</div><div className="mt-4 divide-y border-y">{dictionaryDefinitions(entry).map((definition, index) => <article key={index} className="py-5"><div className="text-xs font-semibold text-brand-strong">{definition.partOfSpeech}</div><p className="mt-2 leading-7">{definition.definition}</p>{definition.example && <p className="mt-2 text-sm italic text-ink-muted">{definition.example}</p>}<Button type="button" variant="ghost" size="sm" className="mt-2" disabled={!state.sets.length} onClick={() => { setAdding({ word: entry.word, pos: definition.partOfSpeech, example: definition.example ?? "" }); setTargetSets(state.sets[0] ? [state.sets[0].id] : []); setSaved(false); }}><Plus className="size-4" />{state.sets.length ? t("dictionary.add") : t("dictionary.noSets")}</Button></article>)}</div></section>; })}</div>
    {adding && <div className="fixed inset-0 z-50 grid place-items-end bg-ink/20 p-4 sm:place-items-center"><section role="dialog" aria-modal="true" className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-[1.75rem] bg-surface p-6 shadow-2xl"><h2 className="text-xl font-semibold">{adding.word} · {adding.pos}</h2><div className="mt-5 grid gap-5"><fieldset><legend className="text-xs font-semibold text-ink-muted">{t("dictionary.targetSet")} · {t("dictionary.targetSetsHint")}</legend><div className="mt-2 grid gap-2">{state.sets.map((entry) => <label key={entry.id} className="flex min-h-10 items-center gap-3 rounded-xl bg-brand-soft px-3 text-sm"><input type="checkbox" checked={targetSets.includes(entry.id)} onChange={(event) => setTargetSets(event.target.checked ? [...targetSets, entry.id] : targetSets.filter((id) => id !== entry.id))} className="accent-[var(--brand)]" />{entry.setName}</label>)}</div></fieldset>{existingWord?.senses.length ? <label><span className="mb-2 block text-xs font-semibold text-ink-muted">{t("dictionary.senseDestination")}</span><select value={senseDestination} onChange={(event) => setSenseDestination(event.target.value)} className="h-11 w-full rounded-xl border bg-surface px-3"><option value="new">{t("dictionary.newSense")}</option>{existingWord.senses.map((sense) => <option key={sense.id} value={sense.id}>{t("dictionary.existingSense")} · {sense.pos} {sense.meaningZh}</option>)}</select></label> : null}{senseDestination === "new" && <label><span className="mb-2 block text-xs font-semibold text-ink-muted">{t("dictionary.meaningZh")}</span><Input value={meaningZh} onChange={(event) => setMeaningZh(event.target.value)} /></label>}{adding.example && <label><span className="mb-2 block text-xs font-semibold text-ink-muted">{t("dictionary.examples")}</span><Input value={adding.example} onChange={(event) => setAdding({ ...adding, example: event.target.value })} /></label>}</div><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setAdding(null)}>{t("setEditor.cancel")}</Button><Button type="button" disabled={!targetSets.length || (senseDestination === "new" && !meaningZh.trim())} onClick={() => void add()}>{t("dictionary.confirm")}</Button></div></section></div>}
  </div>;
}
