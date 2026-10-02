/**
 * Reads the Playwright JSON report and makes skipped tests impossible to miss: a `::warning::` annotation for each
 * and a section in the job summary (FN-03: a skipped journey must be visible, never a silent green).
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const summaryPath = process.argv[2] ?? '/dev/null';
const reportPath = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? 'playwright-report.json';
if (!existsSync(reportPath)) {
  console.log('::error::No Playwright JSON report found: the suite did not run.');
  process.exit(0);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const rows = [];
const walk = (suite) => {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) rows.push({ title: spec.title, status: t.status, notes: (t.annotations ?? []).map((a) => a.description).filter(Boolean) });
  }
  for (const child of suite.suites ?? []) walk(child);
};
for (const s of report.suites ?? []) walk(s);

const lines = ['## Golden Journey L3 (UI, ephemeral stack)', '', '| Variant | Result |', '|---|---|'];
for (const row of rows) {
  lines.push(`| ${row.title} | ${row.status === 'skipped' ? '**SKIPPED**' : row.status} |`);
  if (row.status === 'skipped') {
    console.log(`::warning title=Golden Journey L3 test SKIPPED::${row.title} did NOT run. ${row.notes.join(' ')}`);
    lines.push('', `> SKIPPED: ${row.title}. ${row.notes.join(' ')}`, '');
  }
}
appendFileSync(summaryPath, lines.join('\n') + '\n');
console.log(lines.join('\n'));
