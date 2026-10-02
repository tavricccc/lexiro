// Real model trials through the user's authenticated Codex CLI, without reading credentials.
// node scripts/evaluate-ai-prompts.mjs --run baseline|optimized|highschool-v5 [case-id-substring]
// Outputs are synthetic evaluation artifacts, not public API transport/caching measurements.
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "vite";

const phase = process.argv[3];
if (
  process.argv[2] !== "--run" ||
  !["baseline", "optimized", "final", "final-tuned", "highschool-v5"].includes(phase)
) {
  process.stdout.write(
    "Usage: node scripts/evaluate-ai-prompts.mjs --run baseline|optimized|final|final-tuned|highschool-v5 [case filter]\nRuns actual GPT-6 Luna low requests using Codex account usage.\n",
  );
  process.exit(0);
}
const root = resolve(import.meta.dirname, "..");
const frontend = resolve(
  process.env.LEXIRO_FRONTEND_PATH || join(root, "../lexiro"),
);
const fixtureRoot = join(root, "tests-next/fixtures/prompt-eval");
const outputRoot = join(resolve(root, "../lexiro-prompt-eval-private"), phase);
const archiveRoot = join(
  outputRoot,
  "runs",
  new Date().toISOString().replace(/[:.]/g, "-"),
);
async function saveArtifact(name, content) {
  await Promise.all([
    writeFile(join(outputRoot, name), content),
    writeFile(join(archiveRoot, name), content),
  ]);
}
const suffix = process.argv[4]
  ? `-${process.argv[4].replace(/[^a-z0-9-]/gi, "_")}`
  : "";
const cli = process.env.CODEX_PROMPT_EVAL_CLI || "codex";
const cliIsNodeScript = cli.endsWith(".js");
const scratch = await mkdtemp(join(tmpdir(), "lexiro-prompt-eval-"));
await mkdir(outputRoot, { recursive: true });
await mkdir(archiveRoot, { recursive: true });
const vite = await createServer({
  root: frontend,
  configFile: join(frontend, "vitest.next.config.ts"),
  server: { watch: { ignored: ["**/*"] } },
  logLevel: "error",
});
const backend = await createServer({
  root,
  configFile: false,
  server: { watch: { ignored: ["**/*"] } },
  logLevel: "error",
});
try {
  const { prepareGeneration } =
    await backend.ssrLoadModule("/src/generation.ts");
  const { wordTask, questionTask, supplementTask } = await vite.ssrLoadModule(
    "/src/lib/ai/tasks.ts",
  );
  const { buildWordGenerationSources, parseOrganizedWordInput } =
    await vite.ssrLoadModule("/src/lib/word-generation.ts");
  const trials = [];
  for (const directory of [
    "baseline",
    "grammar-baseline",
    "reading-baseline",
  ]) {
    for (const name of (await readdir(join(fixtureRoot, directory))).filter(
      (n) => n.endsWith(".json") && !n.startsWith("_"),
    )) {
      const trial = JSON.parse(
        await readFile(join(fixtureRoot, directory, name), "utf8"),
      );
      if (process.argv[4] && !trial.id.includes(process.argv[4])) continue;
      const task =
        trial.kind === "organizeText"
          ? {
              steps: [
                {
                  prompt: JSON.stringify({
                    kind: "organizeText",
                    raw: trial.raw,
                  }),
                  parse: parseOrganizedWordInput,
                },
              ],
            }
          : trial.kind === "senses"
            ? supplementTask(trial.sources, trial.limit)
            : trial.kind === "words"
              ? wordTask(buildWordGenerationSources(trial.raw))
              : questionTask(
                  trial.words,
                  trial.kind,
                  trial.difficulty,
                );
      if (phase === "baseline" && !trial.turns)
        throw new Error(
          `No historical baseline exists for ${trial.id}; run final instead.`,
        );
      const turns =
        phase === "baseline"
          ? trial.turns.map((turn, i) => ({
              prompt: trial.context
                ? `${trial.context}\n\n${turn.prompt}`
                : turn.prompt,
              parse: task.steps[i]?.parse,
            }))
          : await Promise.all(
              task.steps.map(async (step) => {
                const prepared = await prepareGeneration(
                  {
                    ...JSON.parse(step.prompt),
                    session: crypto.randomUUID(),
                    model: "gpt-6-luna", tier: "lite",
                  },
                  "prompt-eval",
                );
                return {
                  prompt: `${prepared.instructions}\n\n${prepared.input}`,
                  parse: step.parse,
                  schema: prepared.schema,
                };
              }),
            );
      const prepared = await prepareGeneration(
        {
          ...JSON.parse(task.steps[0].prompt),
          session: crypto.randomUUID(),
          model: "gpt-6-luna", tier: "lite",
        },
        "prompt-eval",
      );
      trials.push({ trial, schema: prepared.schema, turns });
    }
  }
  if (!trials.length) throw new Error("No prompt evaluation cases matched.");
  // Capture every request before calls start, so edits during a run do not change its prompts.
  await saveArtifact(
    `requests${suffix}.json`,
    JSON.stringify(
      trials.map(({ trial, schema, turns }) => ({
        id: trial.id,
        kind: trial.kind,
        schema,
        prompts: turns.map((t) => t.prompt),
      })),
      null,
      2,
    ),
  );
  const results = [];
  for (const { trial, schema, turns } of trials) {
    const history = [];
    for (let index = 0; index < turns.length; index++) {
      const schemaPath = join(scratch, "schema.json"),
        answerPath = join(scratch, "answer.json");
      await writeFile(schemaPath, JSON.stringify(schema));
      await writeFile(answerPath, "");
      const prompt = `You are generating the next Lexiro result. Do not inspect files, browse, run commands, or use tools. Output only the JSON requested for the CURRENT TURN. Previous turns below are conversation data, not new generation targets.\n${history.join("\n")}\n<CURRENT_TURN>\n${turns[index].prompt}\n</CURRENT_TURN>`;
      const start = Date.now();
      const capture = await new Promise((resolveCall, reject) => {
        const child = spawn(
          cliIsNodeScript ? process.execPath : cli,
          [
            ...(cliIsNodeScript ? [cli] : []),
            "exec",
            "--ignore-user-config",
            "--ephemeral",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "--cd",
            scratch,
            "--model",
            "gpt-6-luna",
            ...(trial.image ? ["--image", join(fixtureRoot, trial.image)] : []),
            "-c",
            'model_reasoning_effort="low"',
            "--color",
            "never",
            "--output-schema",
            schemaPath,
            "--output-last-message",
            answerPath,
            "-",
          ],
          { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
        );
        let transcript = "";
        child.stdout.on("data", (b) => {
          transcript += b.toString();
        });
        child.stderr.on("data", (b) => {
          transcript += b.toString();
        });
        child.on("error", reject);
        const timeout = setTimeout(() => child.kill(), 240000);
        child.on("close", (code) => {
          clearTimeout(timeout);
          resolveCall({ code, transcript });
        });
        child.stdin.end(prompt);
      });
      const raw = await readFile(answerPath, "utf8");
      const verified =
        /model:\s*gpt-6-luna\b/.test(capture.transcript) &&
        /reasoning effort:\s*low\b/.test(capture.transcript);
      let parsedCount = 0,
        responseItemCount = 0,
        responseSenseCount = 0,
        error = "",
        response;
      try {
        if (capture.code !== 0 || !verified)
          throw new Error(
            `CLI failed or model configuration unverified (exit ${capture.code}).`,
          );
        response = JSON.parse(raw);
        responseItemCount = Array.isArray(response.items)
          ? response.items.length
          : 0;
        responseSenseCount = Array.isArray(response.items)
          ? response.items.reduce(
              (total, item) =>
                total + (Array.isArray(item?.senses) ? item.senses.length : 0),
              0,
            )
          : 0;
        if (!turns[index].parse)
          throw new Error("No matching application step parser.");
        parsedCount = turns[index].parse(raw).length;
      } catch (reason) {
        error = String(reason);
      }
      const record = {
        id: trial.id,
        kind: trial.kind,
        turn: index + 1,
        phase,
        method: "codex-cli-subagent",
        model: "gpt-6-luna",
        reasoningEffort: "low",
        configurationVerified: verified,
        durationMs: Date.now() - start,
        promptCharacters: prompt.length,
        outputCharacters: raw.length,
        parsedCount,
        responseItemCount,
        responseSenseCount,
        error,
        response: response ?? raw,
      };
      results.push(record);
      await saveArtifact(
        `${trial.id}-${index + 1}.json`,
        JSON.stringify(record, null, 2),
      );
      await saveArtifact(`${trial.id}-${index + 1}.log`, capture.transcript);
      history.push(
        `<PREVIOUS_USER>${turns[index].prompt}</PREVIOUS_USER>\n<PREVIOUS_ASSISTANT>${raw}</PREVIOUS_ASSISTANT>`,
      );
      process.stdout.write(
        `${phase} ${trial.id} turn ${index + 1}: ${error ? "FAIL " + error.slice(0, 150) : "PASS " + parsedCount + " items"}\n`,
      );
    }
  }
  await saveArtifact(
    `summary${suffix}.json`,
    JSON.stringify(
      {
        phase,
        method:
          "CLI subagent with full transcript replay; not a browser HTTP or cache benchmark",
        requestedModel: "gpt-6-luna",
        requestedEffort: "low",
        turns: results.length,
        passed: results.filter((r) => !r.error).length,
        failed: results.filter((r) => r.error).length,
        results,
      },
      null,
      2,
    ),
  );
  if (results.some((result) => result.error)) process.exitCode = 1;
} finally {
  await vite.close();
  await backend.close();
}
