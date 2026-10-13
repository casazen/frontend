import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DEPLOY-CFG: `.env.example` lists every `VITE_*` variable the code reads (and nothing else), so the example, the code and
 * the backend checklist (`docs/runbooks/deploy-checklist.md` § 4) cannot drift apart. A new variable: add it to
 * `.env.example` (commented out when it is optional) and to the checklist; a removed one: delete its line.
 */
const ROOT = process.cwd();

// Reading the whole source tree takes seconds on a loaded machine. The tests share ONE pass over it (QA-INFRA-01): the second
// test used to repeat it for every variable of `.env.example` and the file timed out under load. The per-test limit is a
// guard for the pass itself, not for repeated ones.
const SCAN_TIMEOUT_MS = 30_000;

// A variable name not glued to a longer identifier (`FINAL_INVITE_CODES` contains `VITE_CODES`).
const VARIABLE = /(?<![A-Za-z0-9_])VITE_[A-Z0-9_]+/g;

function isTestFile(path: string): boolean {
  return /(__tests__|\/src\/test\/)|\.test\.[tj]sx?$/.test(path.replaceAll('\\', '/'));
}

function sourceFiles(dir: string): string[] {
  // `withFileTypes` tells files from directories without a `stat` for each entry.
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !isTestFile(path) ? [path] : [];
  });
}

function variablesIn(text: string): Set<string> {
  return new Set(text.match(VARIABLE) ?? []);
}

function variablesUsedByTheCode(): Set<string> {
  const files = [...sourceFiles(join(ROOT, 'src')), ...sourceFiles(join(ROOT, 'api')), join(ROOT, 'vite.config.ts')];
  const used = new Set<string>();
  for (const file of files) for (const name of variablesIn(readFileSync(file, 'utf8'))) used.add(name);
  return used;
}

describe('.env.example (DEPLOY-CFG)', () => {
  const example = variablesIn(readFileSync(join(ROOT, '.env.example'), 'utf8'));

  // The one pass over the tree, made on first use and shared by the tests that need it.
  let usedByTheCode: Set<string> | undefined;
  const variablesRead = () => (usedByTheCode ??= variablesUsedByTheCode());

  it('envExample_EveryVariableTheCodeReads_IsListed', { timeout: SCAN_TIMEOUT_MS }, () => {
    const missing = [...variablesRead()].filter((name) => !example.has(name)).sort();

    expect(missing, `Add to .env.example and to the checklist (backend docs/runbooks/deploy-checklist.md § 4): ${missing.join(', ')}`).toEqual([]);
  });

  it('envExample_EveryListedVariable_IsReadByTheCode', { timeout: SCAN_TIMEOUT_MS }, () => {
    const read = variablesRead();
    const stale = [...example].filter((name) => !read.has(name)).sort();

    expect(stale, `No code reads these: delete them from .env.example: ${stale.join(', ')}`).toEqual([]);
  });

  it('envExample_VercelRequiredVariables_AreListed', () => {
    // The three variables a Vercel Preview/Production build fails without (src/config/vercel-build-env.ts).
    for (const name of ['VITE_API_BASE_URL', 'VITE_AUTH0_DOMAIN', 'VITE_AUTH0_CLIENT_ID']) {
      expect(example.has(name)).toBe(true);
    }
  });
});
