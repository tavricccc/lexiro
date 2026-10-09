/** One process-wide bound. Requests are independent; warm groups only share a start barrier. */
export async function schedule(jobs, { concurrency, warmFirst, execute }) {
  const pending = jobs.map((job, index) => ({ job, index }));
  const outcomes = Array.from({ length: jobs.length });
  const groups = new Map(), stoppedModels = new Set(), active = new Set();
  let maximumActive = 0;
  const eligible = entry => {
    const state = groups.get(entry.job.groupKey);
    return !warmFirst || !state || state === 'ready';
  };
  while (pending.length || active.size) {
    for (let index = pending.length - 1; index >= 0; index--) {
      const entry = pending[index];
      if (stoppedModels.has(entry.job.model)) {
        outcomes[entry.index] = { job: entry.job, skipped: true, reason: 'model-stopped-after-transport-failure' };
        pending.splice(index, 1);
      }
    }
    while (active.size < concurrency) {
      const at = pending.findIndex(eligible);
      if (at === -1) break;
      const { job, index } = pending.splice(at, 1)[0];
      if (!groups.has(job.groupKey)) groups.set(job.groupKey, warmFirst ? 'warming' : 'ready');
      const promise = Promise.resolve().then(() => execute(job)).then(result => {
        outcomes[index] = { job, result };
        if (result.error) stoppedModels.add(job.model);
        groups.set(job.groupKey, 'ready');
      }).finally(() => active.delete(promise));
      active.add(promise);
      maximumActive = Math.max(maximumActive, active.size);
    }
    if (active.size) await Promise.race(active);
    else if (pending.length) throw new Error('Evaluation scheduler has no eligible job.');
  }
  return { outcomes, maximumActive, stoppedModels: [...stoppedModels] };
}
