"use client";

import type { DashboardStats, LearningProgress, LibraryState } from "@/types";
import { Download, Upload } from "lucide-react";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { mergeLibraryStates } from "@/src/lib/library-merge";
import { normalizeDashboardStats, normalizeLearningProgress, normalizeLibraryState } from "@/src/lib/share";

interface AiSettings { mode: "manual" | "api"; provider: string; model: string; endpoint: string; batchSize: number }
interface Backup { schemaVersion: 2; exportedAt: string; library: LibraryState; progress: LearningProgress; stats: DashboardStats; ai: AiSettings }
interface PendingBackup { library: LibraryState; progress: LearningProgress; stats: DashboardStats; ai?: AiSettings; sets: number; questions: number; cards: number }
const AI_KEY = "lexiro-next-ai-settings";
const API_KEY = "lexiro-next-ai-api-key";

export function SettingsPage() {
  const library = useLibraryStore();
  const learning = useLearningStore();
  const cloud = useCloudStore();
  const { theme, setTheme } = useTheme();
  const [wordGoal, setWordGoal] = useState(learning.stats.dailyWordGoal);
  const [questionGoal, setQuestionGoal] = useState(learning.stats.dailyQuestionGoal);
  const [ai, setAi] = useState<AiSettings>({ mode: "manual", provider: "openai", model: "gpt-5-mini", endpoint: "", batchSize: 10 });
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [pendingBackup, setPendingBackup] = useState<PendingBackup | null>(null);
  const [confirmSignIn, setConfirmSignIn] = useState(false);

  useEffect(() => {
    try { const saved = localStorage.getItem(AI_KEY); if (saved) setAi(normalizeAiSettings(JSON.parse(saved))); setApiKey(localStorage.getItem(API_KEY) ?? ""); } catch { /* ignore invalid local settings */ }
  }, []);
  useEffect(() => { if (learning.loaded) { setWordGoal(learning.stats.dailyWordGoal); setQuestionGoal(learning.stats.dailyQuestionGoal); } }, [learning.loaded, learning.stats.dailyQuestionGoal, learning.stats.dailyWordGoal]);

  const saveAi = () => { const normalized = normalizeAiSettings(ai); setAi(normalized); localStorage.setItem(AI_KEY, JSON.stringify(normalized)); localStorage.setItem(API_KEY, apiKey); setMessage(t("settings.aiSaved")); };
  const downloadJson = (name: string, value: unknown) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
  };
  const exportBackup = () => {
    const backup: Backup = { schemaVersion: 2, exportedAt: new Date().toISOString(), library: library.state, progress: learning.progress, stats: learning.stats, ai };
    const bytes = zipSync({ "lexiro-backup.json": strToU8(JSON.stringify(backup)) }) as Uint8Array<ArrayBuffer>;
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `lexiro-backup-${new Date().toLocaleDateString("en-CA")}.zip`; anchor.click(); URL.revokeObjectURL(url);
  };
  const importBackup = async (file: File) => {
    setMessage("");
    try {
      const raw = unzipSync(new Uint8Array(await file.arrayBuffer()))["lexiro-backup.json"];
      if (!raw) throw new Error("lexiro-backup.json missing");
      const source = JSON.parse(strFromU8(raw)) as Partial<Backup>;
      if (source.schemaVersion !== 2) throw new Error("schemaVersion unsupported");
      const incomingLibrary = normalizeLibraryState(source.library);
      const incomingProgress = normalizeLearningProgress(source.progress);
      const incomingStats = normalizeDashboardStats(source.stats);
      const mergedLibrary = mergeLibraryStates(library.state, incomingLibrary);
      const mergedProgress: LearningProgress = { cards: { ...incomingProgress.cards, ...learning.progress.cards }, updatedAt: new Date().toISOString() };
      const hasLocalActivity = learning.stats.totalMemoryReviews > 0 || learning.stats.totalQuestionReviews > 0 || learning.stats.xp > 0 || Object.keys(learning.stats.dailyHistory).length > 0;
      const mergedStats = hasLocalActivity ? learning.stats : incomingStats;
      const addedCards = Object.keys(incomingProgress.cards).filter((senseId) => !learning.progress.cards[senseId]).length;
      setPendingBackup({ library: mergedLibrary.state, progress: mergedProgress, stats: mergedStats, ...(isAiSettings(source.ai) ? { ai: source.ai } : {}), sets: mergedLibrary.result.addedSets, questions: mergedLibrary.result.addedQuestions, cards: addedCards });
    } catch (reason) { setMessage(t("settings.invalidBackup", { message: reason instanceof Error ? reason.message : String(reason) })); }
  };
  const importAi = async (file: File) => {
    try { const value = JSON.parse(await file.text()) as unknown; if (!isAiSettings(value)) throw new Error("AI settings format invalid"); setAi(value); localStorage.setItem(AI_KEY, JSON.stringify(value)); setMessage(t("settings.aiSaved")); }
    catch (reason) { setMessage(t("settings.invalidBackup", { message: reason instanceof Error ? reason.message : String(reason) })); }
  };

  return <div><PageHeader title={t("settings.title")} description={t("settings.description")} /><div className="grid gap-10 lg:grid-cols-2">
    <Section title={t("settings.appearance")}><Field label={t("settings.theme")}><select value={theme} onChange={(event) => setTheme(event.target.value)} className="h-11 w-full rounded-xl border bg-card px-3"><option value="system">{t("settings.system")}</option><option value="light">{t("settings.light")}</option><option value="dark">{t("settings.dark")}</option></select></Field></Section>
    <Section title={t("settings.learning")}><Field label={t("settings.dailyWords")}><Input type="number" min={1} max={100} value={wordGoal} onChange={(event) => setWordGoal(Number(event.target.value))} /></Field><Field label={t("settings.dailyQuestions")}><Input type="number" min={1} max={100} value={questionGoal} onChange={(event) => setQuestionGoal(Number(event.target.value))} /></Field><Button onClick={() => void learning.setGoals(wordGoal, questionGoal)}>{t("settings.saveGoals")}</Button></Section>
    <Section title={t("settings.ai")}><Field label={t("settings.aiMode")}><select value={ai.mode} onChange={(event) => setAi({ ...ai, mode: event.target.value as AiSettings["mode"] })} className="h-11 w-full rounded-xl border bg-card px-3"><option value="manual">{t("settings.manual")}</option><option value="api">{t("settings.api")}</option></select></Field><Field label={t("settings.provider")}><Input value={ai.provider} onChange={(event) => setAi({ ...ai, provider: event.target.value })} /></Field><Field label={t("settings.model")}><Input value={ai.model} onChange={(event) => setAi({ ...ai, model: event.target.value })} /></Field><Field label={t("settings.endpoint")}><Input value={ai.endpoint} onChange={(event) => setAi({ ...ai, endpoint: event.target.value })} /></Field><Field label={t("settings.batchSize")}><Input type="number" min={1} max={50} value={ai.batchSize} onChange={(event) => setAi({ ...ai, batchSize: Number(event.target.value) })} /></Field><Field label={t("settings.apiKey")}><Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></Field><div className="flex flex-wrap gap-2"><Button onClick={saveAi}>{t("settings.saveAi")}</Button><Button variant="secondary" onClick={() => downloadJson("lexiro-ai-settings.json", ai)}><Download className="size-4" />{t("settings.exportAi")}</Button><Button asChild variant="ghost"><label className="cursor-pointer"><Upload className="size-4" />{t("settings.importAi")}<input type="file" accept=".json,application/json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importAi(file); }} /></label></Button></div></Section>
    <Section title={t("settings.data")}><div className="flex flex-wrap gap-3"><Button onClick={exportBackup}><Download className="size-4" />{t("settings.export")}</Button><Button asChild variant="secondary"><label className="cursor-pointer"><Upload className="size-4" />{t("settings.import")}<input type="file" accept=".zip" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file); }} /></label></Button></div></Section>
    <Section title={t("settings.account")}><p className="text-sm leading-6 text-muted-foreground">{cloud.configured ? (cloud.user?.email ?? t("settings.offlineReady")) : t("settings.notConfigured")}</p><div className="flex flex-wrap gap-2">{cloud.configured && !cloud.user && <Button onClick={() => { const hasGuestData = library.state.sets.length > 0 || learning.stats.totalMemoryReviews > 0 || learning.stats.totalQuestionReviews > 0; if (hasGuestData) setConfirmSignIn(true); else void cloud.signIn(); }}>{t("settings.signIn")}</Button>}{cloud.user && <><Button onClick={() => void cloud.sync()} disabled={cloud.status === "syncing"}>{t("settings.syncNow")}</Button><Button variant="secondary" onClick={() => void cloud.signOut()}>{t("settings.signOut")}</Button></>}<span className="inline-flex items-center rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground">{syncStatusLabel(cloud.status)}</span>{cloud.pending && <span className="inline-flex items-center rounded-full bg-warning/10 px-3 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{t("settings.syncPending")}</span>}</div>{cloud.error && <p className="text-sm text-destructive">{cloud.error}</p>}</Section>
    {message && <p role="status" className="lg:col-span-2 rounded-2xl bg-muted px-5 py-4 text-sm text-foreground">{message}</p>}
  </div><ConfirmDialog open={Boolean(pendingBackup)} onOpenChange={(open) => { if (!open) setPendingBackup(null); }} title={t("settings.importTitle")} description={pendingBackup ? t("settings.importPreview", { sets: pendingBackup.sets, questions: pendingBackup.questions, cards: pendingBackup.cards }) : ""} confirmLabel={t("settings.import")} onConfirm={async () => { if (!pendingBackup) return; await library.importState(pendingBackup.library); await learning.importState(pendingBackup.progress, pendingBackup.stats); if (pendingBackup.ai) { setAi(pendingBackup.ai); localStorage.setItem(AI_KEY, JSON.stringify(pendingBackup.ai)); } setPendingBackup(null); setMessage(t("settings.importDone")); }} /><ConfirmDialog open={confirmSignIn} onOpenChange={setConfirmSignIn} title={t("settings.signIn")} description={t("settings.guestDataWarning")} confirmLabel={t("settings.continueSignIn")} onConfirm={async () => { setConfirmSignIn(false); await cloud.signIn(); }} /></div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="border-t pt-6"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-5 grid gap-4">{children}</div></section>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className="mb-2 block text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>; }
function isAiSettings(value: unknown): value is AiSettings { if (!value || typeof value !== "object") return false; const source = value as Record<string, unknown>; return (source.mode === "manual" || source.mode === "api") && typeof source.provider === "string" && typeof source.model === "string" && typeof source.endpoint === "string" && typeof source.batchSize === "number" && source.batchSize >= 1; }
function normalizeAiSettings(value: unknown): AiSettings { const source = value && typeof value === "object" ? value as Partial<AiSettings> : {}; const batchSize = typeof source.batchSize === "number" && Number.isFinite(source.batchSize) ? Math.min(50, Math.max(1, Math.round(source.batchSize))) : 10; return { mode: source.mode === "api" ? "api" : "manual", provider: typeof source.provider === "string" ? source.provider : "openai", model: typeof source.model === "string" ? source.model : "gpt-5-mini", endpoint: typeof source.endpoint === "string" ? source.endpoint : "", batchSize }; }
function syncStatusLabel(status: string) { if (status === "disabled") return t("settings.syncDisabled"); if (status === "signed-out") return t("settings.syncSignedOut"); if (status === "synced") return t("settings.syncSynced"); if (status === "offline") return t("settings.syncOffline"); if (status === "error") return t("settings.syncError"); if (status === "connecting") return t("settings.syncConnecting"); return t("settings.syncWorking"); }
