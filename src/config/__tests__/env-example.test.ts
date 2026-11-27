import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const SCAN_TIMEOUT_MS = 30_000;

const VARIABLE = /(?<![A-Za-z0-9_])VITE_[A-Z0-9_]+/g;

function isTestFile(path: string): boolean {
  return /(__tests__|\/src\/test\/)|\.test\.[tj]sx?$/.test(path.replaceAll('\\', '/'));
}

function sourceFiles(dir: string): string[] {
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
    for (const name of ['VITE_API_BASE_URL', 'VITE_AUTH0_DOMAIN', 'VITE_AUTH0_CLIENT_ID']) {
      expect(example.has(name)).toBe(true);
    }
  });
});
