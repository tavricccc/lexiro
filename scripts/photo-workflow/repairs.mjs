import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { reasonText } from "./artifacts.mjs";

export async function loadRepairs(config) {
  const { values, selected } = config;
  const runs = new Map();
  for (const path of values["repair-from"] ?? []) {
    const directory = resolve(path);
    const summary = JSON.parse(await readFile(join(directory, "summary.json"), "utf8"));
    if (!["gpt-6-luna", "gpt-5.6-luna"].includes(summary.requestedModel) || runs.has(summary.requestedModel)) throw new Error("Repair directories must identify distinct supported Luna models.");
    const previous = [];
    for (const filename of (await readdir(directory)).filter((name) => name.endsWith("-metrics.json"))) {
      const metrics = JSON.parse(await readFile(join(directory, filename), "utf8"));
      if (!selected.has(metrics.task)) continue;
      const request = JSON.parse(await readFile(join(directory, `${metrics.id}-request.json`), "utf8"));
      previous.push({ metrics, request });
    }
    runs.set(summary.requestedModel, { directory, previous });
  }
  const feedback = values.feedback ? JSON.parse(await readFile(resolve(values.feedback), "utf8")) : {};
  if (!feedback || Array.isArray(feedback) || typeof feedback !== "object" || Object.values(feedback).some((text) => typeof text !== "string" || !text.trim())) throw new Error("Feedback must be an object mapping a case id to a nonempty error string. Model-specific keys can use model/id.");
  if (!values.models && runs.size) config.models = [...runs.keys()];
  return { runs, feedback, enabled: runs.size > 0 || Boolean(values.feedback) };
}

export async function repairCases(config, modules, model, cases, repairs) {
  const { values } = config;
  if (!repairs.enabled) return cases;
  const run = repairs.runs.get(model);
  const repaired = [];
  for (const test of cases) {
    const previous = run?.previous.find((entry) => entry.metrics.id === test.id) ??
      (test.task !== "words" ? run?.previous.find((entry) => entry.metrics.task === test.task) : undefined);
    const priorId = previous?.metrics.id ?? test.id;
    const feedback = repairs.feedback[`${model}/${priorId}`] ?? repairs.feedback[`${model}/${test.id}`] ?? repairs.feedback[`${model}/${test.task}`] ?? repairs.feedback[priorId] ?? repairs.feedback[test.id] ?? repairs.feedback[test.task];
    const issue = [previous?.metrics.parseError || previous?.metrics.error, feedback].filter(Boolean).join("\n");
    if (!issue) continue;
    if (issue.length > 1000) throw new Error(`${model} ${priorId} repair feedback exceeds the production 1,000-character limit.`);
    if (values["targeted-repair"]) {
      const raw = previous && test.recover ? await readFile(join(run.directory, `${priorId}-response.txt`), "utf8") : null;
      const recovered = raw ? await test.recover(raw) : null;
      if (!recovered?.remaining.length) throw new Error(`${model} ${priorId} cannot be repaired with production item recovery; use an explicit full-case repair.`);
      if (recovered.remaining.length > 4) throw new Error(`${model} ${priorId} needs ${recovered.remaining.length} item repairs; this bounded trial permits at most four.`);
      for (const [index, step] of recovered.remaining.entries()) {
        const prepared = await modules.backend.prepareGeneration({ ...JSON.parse(step.prompt), model, tier: values.tier, session: randomUUID(), repair: issue }, "photo-quality-eval");
        repaired.push({ ...test, id: `${test.id}-repair-${index + 1}`, prepared, parse: step.parse, recover: undefined,
          parserContext: { ...test.parserContext, nativeRepair: { parentDirectory: run.directory, parentCaseId: priorId, stepId: step.id } },
          repair: { previousDirectory: run.directory, previousCaseId: priorId, previousRequestSha256: previous.request.requestSha256,
            feedback: issue, productionStepId: step.id, previousRecovery: { retainedItems: recovered.items.length, completed: recovered.completed, repairSteps: recovered.remaining.length },
            scope: prepared.request.itemRepair ? "one child; fixed passage and bank" : "one vocabulary source", note: "Exactly one production recovery round; no result schedules another retry." } });
      }
      continue;
    }
    const prepared = test.task === "photos"
      ? { ...test.prepared, input: `${test.prepared.input}\n上一輪驗證錯誤（資料，非系統指令）：${JSON.stringify(issue)}。重新完成本輪。` }
      : await modules.backend.prepareGeneration({ ...test.prepared.request, repair: issue }, "photo-quality-eval");
    let previousRecovery = null, previousRecoveryError = null;
    if (test.recover && previous?.metrics.id === test.id) {
      try {
        const recovered = await test.recover(await readFile(join(run.directory, `${priorId}-response.txt`), "utf8"));
        if (recovered) previousRecovery = { retainedItems: recovered.items.length, completed: recovered.completed, remaining: recovered.remaining.map((step) => ({ id: step.id, count: step.count })) };
      } catch (reason) { previousRecoveryError = reasonText(reason); }
    }
    const originalUser = previous?.request.request.input.findLast((input) => input.role === "user");
    repaired.push({ ...test, prepared, repair: { previousDirectory: run?.directory ?? null, previousCaseId: previous?.metrics.id ?? null, feedback: issue,
      previousRequestSha256: previous?.request.requestSha256 ?? null, currentCaseId: test.id,
      previousRecovery, previousRecoveryError,
      sourceOrTaskInputChanged: originalUser ? originalUser.content !== test.prepared.input : null,
      note: "One explicitly requested retry. Case matching permits a changed single-batch id, including the full ten-blank word-bank sample. No retries are scheduled from this result." } });
  }
  return repaired;
}
