// Blind-review the existing 34 synthetic questions through authenticated Codex CLI.
// No production Worker, API credentials, or human review findings are supplied.
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "vite";

const root = resolve(import.meta.dirname, "..");
const frontend = resolve(process.env.LEXIRO_FRONTEND_PATH || join(root, "../lexiro"));
const artifacts = resolve(root, "../lexiro-prompt-eval-private");
const phase = process.env.LEXIRO_REVIEW_EVAL_PHASE || "highschool-review-v3";
const output = join(artifacts, phase);
const archive = join(output, "runs", new Date().toISOString().replace(/[:.]/g, "-"));
const scratch = await mkdtemp(join(tmpdir(), "lexiro-review-eval-"));
await mkdir(archive, { recursive: true });
const save = async (name, value) => Promise.all([output, archive].map((folder) => writeFile(join(folder, name), value)));
const backend = await createServer({ root, configFile: false, server: { watch: { ignored: ["**/*"] } }, logLevel: "error" });
const client = await createServer({ root: frontend, configFile: join(frontend, "vitest.next.config.ts"), server: { watch: { ignored: ["**/*"] } }, logLevel: "error" });
try {
  const { prepareGeneration } = await backend.ssrLoadModule("/src/generation.ts");
  const { prepareQuestionReview, approvedQuestionResult } = await backend.ssrLoadModule("/src/question-review.ts");
  const { questionTask } = await client.ssrLoadModule("/src/lib/ai/tasks.ts");
  const results = [];
  const inputs = [
    { kind: "vocabulary", trial: "baseline/vocabulary-two-turn.json", prefix: "baseline-vocabulary-two-turn-global-refs", original: "2026-10-02T16-01-36-506Z" },
    { kind: "reading", trial: "reading-baseline/reading-difficulty-2.json", prefix: "reading-difficulty-2", original: "2026-10-02T16-02-33-441Z" },
  ];
  samples: for (const input of inputs) {
    const trial = JSON.parse(await readFile(join(root, "tests-next/fixtures/prompt-eval", input.trial), "utf8"));
    const task = questionTask(trial.words, trial.kind, trial.difficulty);
    for (const version of ["original", "latest"]) {
      for (let turn = 0; turn < task.steps.length; turn++) {
        const name = `${version}-${input.kind}-${turn + 1}`;
        if (process.argv[2] && !name.includes(process.argv[2])) continue;
        const source = join(artifacts, "highschool-v5", ...(version === "original" ? ["runs", input.original] : []), `${input.prefix}-${turn + 1}.json`);
        const draft = JSON.parse(await readFile(source, "utf8"));
        const prepared = await prepareGeneration({ ...JSON.parse(task.steps[turn].prompt), session: crypto.randomUUID(), model: "gpt-6-luna", tier: "lite" }, "review-eval");
        const review = prepareQuestionReview(prepared, draft.response);
        const prompt = `Do not inspect files, browse, run commands, or use tools. Output only the requested JSON. You are reviewing the supplied draft independently, without any prior conversation.\n${review.instructions}\n\n${review.input}`;
        await save(`${name}-request.json`, JSON.stringify({ source, model: "gpt-6-luna", reasoningEffort: "medium", prompt, schema: review.schema }, null, 2));
        const schemaPath = join(scratch, "schema.json");
        const answerPath = join(scratch, "answer.json");
        await writeFile(schemaPath, JSON.stringify(review.schema));
        await writeFile(answerPath, "");
        const start = Date.now();
        const cli = process.env.CODEX_PROMPT_EVAL_CLI || "codex";
        const nodeCli = cli.endsWith(".js");
        const capture = await new Promise((resolveCall, reject) => {
          const child = spawn(nodeCli ? process.execPath : cli, [
            ...(nodeCli ? [cli] : []), "exec", "--ignore-user-config", "--ephemeral", "--skip-git-repo-check",
            "--sandbox", "read-only", "--cd", scratch, "--model", "gpt-6-luna", "-c", 'model_reasoning_effort="medium"',
            "--color", "never", "--output-schema", schemaPath, "--output-last-message", answerPath, "-",
          ], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
          let transcript = "";
          child.stdout.on("data", (chunk) => { transcript += chunk.toString(); });
          child.stderr.on("data", (chunk) => { transcript += chunk.toString(); });
          child.on("error", reject);
          const timeout = setTimeout(() => child.kill(), 240_000);
          child.on("close", (code) => { clearTimeout(timeout); resolveCall({ code, transcript }); });
          child.stdin.end(prompt);
        });
        const raw = await readFile(answerPath, "utf8");
        const verified = /model:\s*gpt-6-luna\b/.test(capture.transcript) && /reasoning effort:\s*medium\b/.test(capture.transcript);
        let response, parsedCount = 0, error = "";
        try {
          if (capture.code !== 0 || !verified) throw new Error(`CLI failed or configuration unverified (${capture.code})`);
          response = JSON.parse(raw);
          const corrected = approvedQuestionResult(prepared, response);
          parsedCount = task.steps[turn].parse(JSON.stringify(corrected)).length;
        } catch (reason) { error = String(reason); }
        const result = { name, source, model: "gpt-6-luna", reasoningEffort: "medium", configurationVerified: verified,
          durationMs: Date.now() - start, parsedCount, error, response: response ?? raw };
        results.push(result);
        await save(`${name}.json`, JSON.stringify(result, null, 2));
        await save(`${name}.log`, capture.transcript);
        process.stdout.write(`${name}: ${error ? `FAIL ${error.slice(0, 160)}` : `PASS ${parsedCount} parsed entries`}\n`);
        // A CLI/account failure cannot be fixed by spending more calls on other samples.
        if (capture.code !== 0) break samples;
      }
    }
  }
  if (!results.length) throw new Error("No review samples matched");
  await save(`summary${process.argv[2] ? `-${process.argv[2]}` : ""}.json`, JSON.stringify({ phase,
    method: "Independent medium Codex CLI review of frozen drafts, without human annotations; not a production API or quality score",
    turns: results.length, passed: results.filter((result) => !result.error).length, results }, null, 2));
  if (results.some((result) => result.error)) process.exitCode = 1;
} finally {
  await client.close();
  await backend.close();
}
