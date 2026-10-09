// Private, immutable Luna plans/runs. CLI usage is not the Lexiro API prefix/cost.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { configuration, help } from './photo-workflow/config.mjs';
import { loadModules } from './photo-workflow/modules.mjs';
import { loadPhotos } from './photo-workflow/photos.mjs';
import { referenceWords, referenceUnits } from './photo-workflow/sources.mjs';
import { loadRepairs } from './photo-workflow/repairs.mjs';
import { evaluateRound } from './photo-workflow/runner.mjs';
import { revalidate } from './photo-workflow/replay.mjs';
import { reasonText } from './photo-workflow/artifacts.mjs';

const config = configuration();
if (config.values.help) console.log(help);
else {
  const modules = await loadModules(config);
  try {
    if (config.replay) {
      const reports = await revalidate(config, modules);
      if (reports.some(report => report.results.some(result => ['PARTIAL', 'CONTENT_FAIL', 'TRANSPORT_FAIL'].includes(result.status)))) process.exitCode = 1;
    } else {
      const repairs = await loadRepairs(config);
      const reference = JSON.parse(await readFile(resolve(config.values.reference), 'utf8'));
      const lines = modules.parseOrganizedWordInput(JSON.stringify(reference));
      const sources = modules.buildWordGenerationSources(lines.join('\n'));
      if (!sources.length) throw new Error('Reference contains no valid word sources.');
      const words = referenceWords(modules, sources);
      const units = referenceUnits(modules, sources, words);
      const photos = await loadPhotos(config, modules.LIMITS);
      const summary = await evaluateRound(config, modules, { reference, sources, words, units, photos, repairs });
      if (summary.results.some(result => result.error || result.parseError)) process.exitCode = 1;
    }
  } catch (reason) { console.error(reasonText(reason)); process.exitCode = 1; }
  finally { await modules.close(); }
}
