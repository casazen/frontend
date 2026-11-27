import fs from 'node:fs'
import path from 'node:path'
import type { TestProjectInlineConfiguration } from 'vitest/config'

/**
 * Splits the Vitest files by environment (used by the `test.projects` of `vite.config.ts`).
 *
 * A `.test.ts` file (no JSX) that uses none of the markers below needs no DOM: it runs in plain Node, without jsdom, jest-dom,
 * the i18n preload and the stand-ins of `src/test/setup.ts`, which is most of the start-up cost of a test file. Every other file
 * keeps jsdom and the whole setup, so a new test lands in the safe group by default. A test that needs the DOM without naming it
 * (its code under test reaches `window`) declares `// @vitest-environment jsdom`, which is also one of the markers.
 */
const NEEDS_DOM = new RegExp(
  [
    '@testing-library', // component tests and jest-dom matchers
    '@vitest-environment', // a test that picked its own environment keeps the full setup
    '\\brender\\w*\\s*\\(', // render, renderHook, renderWithProviders, renderToString
    '\\bcomponent\\s*\\(\\)', // `entry.component()` of the route manifest loads a whole page: its import graph reaches `window`
    '\\b(?:document|window|navigator|localStorage|sessionStorage|HTMLElement|Element|Node|Event|MouseEvent|KeyboardEvent|CustomEvent)\\b',
    '\\b(?:DOMParser|ResizeObserver|IntersectionObserver|matchMedia|XMLHttpRequest|BroadcastChannel)\\b',
    'jsdom',
    '\\?raw', // tests that read the sources as text are the heaviest of the suite: left as they are
    'import\\.meta\\.glob',
    'readFileSync',
  ].join('|'),
)

// File names with glob syntax would be read as patterns by the `include` list.
const GLOB_SYNTAX = /[[\](){}!*?+@]/

// The folders of plain logic whose tests were run in Node. The model tests under `src/features/**` have the same shape (another ~160
// files): add their folders here once they pass in Node too.
const NODE_FOLDERS = ['src/lib', 'src/config', 'src/api', 'src/queries']

/** `.test.ts` files of `NODE_FOLDERS` that need no DOM, as paths relative to `root` with `/` separators, sorted. */
export function listNodeTests(root: string): string[] {
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(full)
      } else if (entry.name.endsWith('.test.ts') && !GLOB_SYNTAX.test(entry.name) && !NEEDS_DOM.test(fs.readFileSync(full, 'utf8'))) {
        found.push(path.relative(root, full).split(path.sep).join('/'))
      }
    }
  }
  for (const folder of NODE_FOLDERS) walk(path.join(root, folder))
  return found.sort()
}

/**
 * The two projects of the suite. They extend `vite.config.ts` (plugins, alias, `globals`, `exclude`); the setup files are given
 * here and not in the root `test` block because arrays of an extended config are concatenated, so the Node project would get them too.
 */
export function vitestProjects(root: string, jsdomSetupFiles: string[]): TestProjectInlineConfiguration[] {
  const nodeTests = listNodeTests(root)
  return [
    { extends: true, test: { name: 'node', environment: 'node', include: nodeTests } },
    { extends: true, test: { name: 'jsdom', environment: 'jsdom', setupFiles: jsdomSetupFiles, exclude: nodeTests } },
  ]
}
