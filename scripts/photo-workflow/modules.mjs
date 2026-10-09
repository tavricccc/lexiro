import { createServer } from 'vite';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest } from './artifacts.mjs';

async function sourceFiles(root, directory) {
  const entries = await readdir(join(root, directory), { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => entry.isDirectory() ? sourceFiles(root, join(directory, entry.name)) : /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? [join(directory, entry.name)] : []));
  return files.flat().sort();
}
export async function loadModules(config) {
  const { root, frontend, values } = config;
  const servers = [];
  try {
    const app = await createServer({ root: frontend, configFile: join(frontend, 'vitest.next.config.ts'), server: { watch: { ignored: ['**/*'] } }, logLevel: 'error' });
    servers.push(app);
    const parserFiles = (await Promise.all(['src/lib', 'packages/ai-contract/src'].map(directory => sourceFiles(frontend, directory)))).flat().sort();
    const hashes = await Promise.all(parserFiles.map(async file => [file.replaceAll('\\', '/'), digest(await readFile(join(frontend, file)))]));
    const frontendVersion = { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: frontend, encoding: 'utf8' }).trim(), files: Object.fromEntries(hashes), sha256: digest(JSON.stringify(hashes)) };
    const tasks = await app.ssrLoadModule('/src/lib/ai/tasks.ts');
    const words = await app.ssrLoadModule('/src/lib/word-generation.ts');
    const library = await app.ssrLoadModule('/src/lib/library.ts');
    const { LIMITS, responseCost, QUESTION_GENERATION_CONTRACT } = await app.ssrLoadModule('/packages/ai-contract/src/index.ts');
    let backend = null, backendVersion = null;
    if (!config.replay) {
      if (values['backend-module']) {
        const file = resolve(values['backend-module']);
        const bytes = await readFile(file);
        backend = await import(pathToFileURL(file).href);
        backendVersion = { path: file, sha256: digest(bytes), frozen: true };
      } else {
        const worker = await createServer({ root, configFile: false, server: { watch: { ignored: ['**/*'] } }, logLevel: 'error' });
        servers.push(worker);
        backend = { ...await worker.ssrLoadModule('/src/generation.ts'), ...await worker.ssrLoadModule('/src/organize.ts') };
        const files = ['src/generation.ts', 'src/organize.ts', 'src/prompts.ts', 'src/question-brief.ts', 'src/question-prompts.ts', 'src/schemas.ts'];
        const hashes = await Promise.all(files.map(async file => [file, digest(await readFile(join(root, file)))]));
        backendVersion = { path: 'current src', files: Object.fromEntries(hashes), sha256: digest(JSON.stringify(hashes)), frozen: false };
      }
    }
    return { ...tasks, ...words, ...library, LIMITS, responseCost, questionContract: QUESTION_GENERATION_CONTRACT, backend, frontendVersion, backendVersion,
      close: () => Promise.all(servers.map(server => server.close())) };
  } catch (reason) { await Promise.all(servers.map(server => server.close())); throw reason; }
}
