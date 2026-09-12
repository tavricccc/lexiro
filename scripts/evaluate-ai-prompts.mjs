// Real model trials through the user's authenticated Codex CLI, without reading credentials.
// node scripts/evaluate-ai-prompts.mjs --run baseline|optimized [case-id-substring]
// Outputs are synthetic evaluation artifacts, not public API transport/caching measurements.
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "vite";

const phase = process.argv[3];
if (
  process.argv[2] !== "--run" ||
  !["baseline", "optimized", "final", "final-tuned"].includes(phase)
) {
  process.stdout.write(
    "Usage: node scripts/evaluate-ai-prompts.mjs --run baseline|optimized [case filter]\nRuns actual GPT-5.6 Luna medium requests using Codex account usage.\n",
  );
  process.exit(0);
}
const root = resolve(import.meta.dirname, "..");
const fixtureRoot = join(root, "tests-next/fixtures/prompt-eval");
const outputRoot = join(root, "artifacts/prompt-eval", phase);
const suffix = process.argv[4]
  ? `-${process.argv[4].replace(/[^a-z0-9-]/gi, "_")}`
  : "";
const cli =
  process.env.CODEX_PROMPT_EVAL_CLI ||
  join(
    process.env.APPDATA ?? "",
    "npm/node_modules/@openai/codex/bin/codex.js",
  );
const scratch = await mkdtemp(join(tmpdir(), "lexiro-prompt-eval-"));
await mkdir(outputRoot, { recursive: true });
const vite = await createServer({
  configFile: join(root, "vitest.next.config.ts"),
  server: { watch: { ignored: ["**/*"] } },
  logLevel: "error",
});
try {
  const { wordTask, questionTask } = await vite.ssrLoadModule(
    "/src/lib/ai/tasks.ts",
  );
  const { buildWordGenerationSources } = await vite.ssrLoadModule(
    "/src/lib/word-generation.ts",
  );
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
        trial.kind === "words"
          ? wordTask(
              trial.raw,
              buildWordGenerationSources(trial.raw),
              trial.examples ?? false,
              trial.batchSize ?? 10,
            )
          : questionTask(
              trial.words,
              trial.words,
              trial.kind,
              trial.difficulty,
            );
      const turns =
        phase === "baseline"
          ? trial.turns.map((turn, i) => ({
              prompt: trial.context
                ? `${trial.context}\n\n${turn.prompt}`
                : turn.prompt,
              parse: task.steps[i]?.parse,
            }))
          : task.steps.map((step) => ({
              prompt: `${task.context}\n\n${step.prompt}`,
              parse: step.parse,
            }));
      trials.push({ trial, schema: task.schema, turns });
    }
  }
  // Capture every request before calls start, so edits during a run do not change its prompts.
  await writeFile(
    join(outputRoot, `requests${suffix}.json`),
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
          process.execPath,
          [
            cli,
            "exec",
            "--ignore-user-config",
            "--ephemeral",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "--cd",
            scratch,
            "--model",
            "gpt-5.6-luna",
            "-c",
            'model_reasoning_effort="medium"',
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
        /model:\s*gpt-5\.6-luna\b/.test(capture.transcript) &&
        /reasoning effort:\s*medium\b/.test(capture.transcript);
      let parsedCount = 0,
        error = "",
        response;
      try {
        if (capture.code !== 0 || !verified)
          throw new Error(
            `CLI failed or model configuration unverified (exit ${capture.code}).`,
          );
        response = JSON.parse(raw);
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
        model: "gpt-5.6-luna",
        reasoningEffort: "medium",
        configurationVerified: verified,
        durationMs: Date.now() - start,
        promptCharacters: prompt.length,
        outputCharacters: raw.length,
        parsedCount,
        error,
        response: response ?? raw,
      };
      results.push(record);
      await writeFile(
        join(outputRoot, `${trial.id}-${index + 1}.json`),
        JSON.stringify(record, null, 2),
      );
      await writeFile(
        join(outputRoot, `${trial.id}-${index + 1}.log`),
        capture.transcript,
      );
      history.push(
        `<PREVIOUS_USER>${turns[index].prompt}</PREVIOUS_USER>\n<PREVIOUS_ASSISTANT>${raw}</PREVIOUS_ASSISTANT>`,
      );
      process.stdout.write(
        `${phase} ${trial.id} turn ${index + 1}: ${error ? "FAIL " + error.slice(0, 150) : "PASS " + parsedCount + " items"}\n`,
      );
    }
  }
  await writeFile(
    join(outputRoot, `summary${suffix}.json`),
    JSON.stringify(
      {
        phase,
        method:
          "CLI subagent with full transcript replay; not a browser HTTP or cache benchmark",
        requestedModel: "gpt-5.6-luna",
        requestedEffort: "medium",
        turns: results.length,
        passed: results.filter((r) => !r.error).length,
        failed: results.filter((r) => r.error).length,
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await vite.close();
}
