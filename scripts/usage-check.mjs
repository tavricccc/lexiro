#!/usr/bin/env node
/**
 * Reports today's (UTC) use of the Workers Free daily quotas and exits 1 when
 * any of them passes ALERT_RATIO, so the scheduled workflow fails and GitHub
 * emails the owner. The quotas are account-wide and reset at 00:00 UTC.
 *
 *   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… node scripts/usage-check.mjs
 *
 * The token needs Account Analytics: Read.
 */
const token = process.env.CLOUDFLARE_API_TOKEN;
const accountTag = process.env.CLOUDFLARE_ACCOUNT_ID;
const ratio = Number(process.env.ALERT_RATIO ?? "0.7");
if (!token || !accountTag) {
  console.error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required");
  process.exit(2);
}

/** The Workers Free plan's daily limits. */
const QUOTAS = {
  workerRequests: 100_000,
  durableObjectRequests: 100_000,
  d1RowsRead: 5_000_000,
  d1RowsWritten: 100_000,
};

const now = new Date();
const day = now.toISOString().slice(0, 10);
const query = `query Usage($accountTag: string!, $day: Date!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: $start, datetime_leq: $end }) {
        sum { requests }
      }
      durableObjectsInvocationsAdaptiveGroups(limit: 10000, filter: { datetime_geq: $start, datetime_leq: $end }) {
        sum { requests }
      }
      d1AnalyticsAdaptiveGroups(limit: 10000, filter: { date: $day }) {
        sum { rowsRead rowsWritten }
      }
    }
  }
}`;

const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query,
    variables: {
      accountTag,
      day,
      start: `${day}T00:00:00Z`,
      end: now.toISOString(),
    },
  }),
});
const body = await response.json();
if (!response.ok || body.errors?.length) {
  console.error(
    "GraphQL Analytics query failed; the token may lack Account Analytics: Read.",
  );
  console.error(JSON.stringify(body.errors ?? body, null, 2));
  process.exit(2);
}
const account = body.data.viewer.accounts[0] ?? {};
const total = (groups, field) =>
  (groups ?? []).reduce((sum, group) => sum + (group.sum?.[field] ?? 0), 0);
const used = {
  workerRequests: total(account.workersInvocationsAdaptive, "requests"),
  durableObjectRequests: total(
    account.durableObjectsInvocationsAdaptiveGroups,
    "requests",
  ),
  d1RowsRead: total(account.d1AnalyticsAdaptiveGroups, "rowsRead"),
  d1RowsWritten: total(account.d1AnalyticsAdaptiveGroups, "rowsWritten"),
};

let alert = false;
const lines = [`Usage for ${day} (UTC) as of ${now.toISOString()}`, ""];
lines.push("| Quota | Used | Limit | Share |", "|---|---:|---:|---:|");
for (const [name, limit] of Object.entries(QUOTAS)) {
  const share = used[name] / limit;
  if (share >= ratio) alert = true;
  lines.push(
    `| ${name} | ${used[name].toLocaleString("en")} | ${limit.toLocaleString("en")} | ${(share * 100).toFixed(1)}%${share >= ratio ? " ⚠" : ""} |`,
  );
}
const report = lines.join("\n");
console.log(report);
const { appendFileSync } = await import("node:fs");
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
// The workflow pauses Agent work on this share; see .github/workflows/usage-watch.yml.
if (process.env.GITHUB_OUTPUT)
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `d1_read_share=${(used.d1RowsRead / QUOTAS.d1RowsRead).toFixed(4)}\n`,
  );
if (alert) {
  console.error(`At least one daily quota passed ${ratio * 100}%.`);
  process.exit(1);
}
