// Revalidate saved real-model replies against the current production parsers.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createServer } from "vite";
const root = resolve(import.meta.dirname, "..");
const fixtures = join(root, "tests-next/fixtures/prompt-eval");
const artifacts = join(root, "artifacts/prompt-eval");
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
  const cases = new Map();
  for (const directory of [
    "baseline",
    "grammar-baseline",
    "reading-baseline",
  ]) {
    for (const name of await readdir(join(fixtures, directory))) {
      if (!name.endsWith(".json") || name.startsWith("_")) continue;
      const trial = JSON.parse(
        await readFile(join(fixtures, directory, name), "utf8"),
      );
      cases.set(trial.id, trial);
    }
  }
  const latest = new Map();
  for (const phase of ["final", "final-tuned"]) {
    for (const name of await readdir(join(artifacts, phase))) {
      if (!name.endsWith(".json") || /^(requests|summary)/.test(name)) continue;
      const reply = JSON.parse(
        await readFile(join(artifacts, phase, name), "utf8"),
      );
      if (cases.has(reply.id))
        latest.set(`${reply.id}:${reply.turn}`, {
          reply,
          file: `${phase}/${name}`,
        });
    }
  }
  const results = [];
  for (const { reply, file } of latest.values()) {
    const trial = cases.get(reply.id);
    const task =
      trial.kind === "words"
        ? wordTask(
            trial.raw,
            buildWordGenerationSources(trial.raw),
            trial.examples ?? false,
            trial.batchSize ?? 10,
          )
        : questionTask(trial.words, trial.words, trial.kind, trial.difficulty);
    let error = "",
      parsedCount = 0;
    try {
      if (!reply.configurationVerified)
        throw new Error("Model configuration not verified");
      parsedCount = task.steps[reply.turn - 1].parse(
        JSON.stringify(reply.response),
      ).length;
    } catch (reason) {
      error = String(reason);
    }
    results.push({ file, parsedCount, error, originalError: reply.error });
  }
  const report = {
    method:
      "Latest saved real CLI response per case and turn, revalidated with current parser; not a new model request or semantic quality score",
    turns: results.length,
    passed: results.filter((r) => !r.error).length,
    results,
  };
  await writeFile(
    join(artifacts, "validation.json"),
    JSON.stringify(report, null, 2),
  );
  process.stdout.write(JSON.stringify(report, null, 2));
} finally {
  await vite.close();
}
