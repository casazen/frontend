#!/usr/bin/env node
/**
 * Development tool, not shipped in the plugin ZIP.
 *
 * There is no PHP on the development machine, so the syntax of the plugin is checked with the npm package `php-parser`:
 * every `*.php` file below the plugin folder (or below the paths given as arguments), outside `vendor/` and
 * `node_modules/`, is parsed as PHP 7.4. The plugin runs on PHP 7.4 to 8.3, so a construct that only exists from PHP 8
 * (`match`, `?->`, named arguments, constructor promotion, union types, `enum`, `readonly`, attributes) is an error.
 *
 * Output: one line `file:line: message` per problem. Exit code 1 when there is any problem, 0 otherwise.
 *
 * Usage: node tools/check-php-syntax.mjs [file-or-folder ...]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import phpParser from 'php-parser';

const Engine = phpParser.Engine ?? phpParser;
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIPPED_FOLDERS = new Set(['vendor', 'node_modules', '.git']);

// Nodes that only exist from PHP 8. The parser is told to read PHP 7.4, which already refuses most of them; this list is
// the second line of defence for the ones a parser version flag can let through.
const PHP8_ONLY_NODES = new Map([
	['match', 'match expression (PHP 8.0)'],
	['matcharm', 'match arm (PHP 8.0)'],
	['nullsafepropertylookup', 'nullsafe operator ?-> (PHP 8.0)'],
	['nullsafemethodcall', 'nullsafe operator ?-> (PHP 8.0)'],
	['namedargument', 'named argument (PHP 8.0)'],
	['uniontype', 'union type (PHP 8.0)'],
	['intersectiontype', 'intersection type (PHP 8.1)'],
	['enum', 'enum (PHP 8.1)'],
	['enumcase', 'enum case (PHP 8.1)'],
	['attrgroup', 'attribute (PHP 8.0)'],
	['attribute', 'attribute (PHP 8.0)'],
]);

// Type names that PHP 7.4 reads as the name of a class that does not exist, so they fail at run time, not at parse time.
const PHP8_ONLY_TYPES = new Map([
	['static', 'static return type (PHP 8.0)'],
	['mixed', 'mixed type (PHP 8.0)'],
	['never', 'never return type (PHP 8.1)'],
	['false', 'false as a stand-alone type (PHP 8.2)'],
	['null', 'null as a stand-alone type (PHP 8.2)'],
]);

/** @param {string} target A file or a folder. @returns {Generator<string>} Every PHP file below it. */
function* phpFiles(target) {
	const info = statSync(target);
	if (info.isFile()) {
		if (target.endsWith('.php')) yield target;
		return;
	}
	for (const entry of readdirSync(target, { withFileTypes: true })) {
		const path = join(target, entry.name);
		if (entry.isDirectory()) {
			if (!SKIPPED_FOLDERS.has(entry.name)) yield* phpFiles(path);
		} else if (entry.isFile() && entry.name.endsWith('.php')) {
			yield path;
		}
	}
}

/** Walks the whole tree and reports every PHP 8 only node. */
function findPhp8Nodes(node, found) {
	if (Array.isArray(node)) {
		for (const child of node) findPhp8Nodes(child, found);
		return;
	}
	if (node === null || typeof node !== 'object') return;

	const reason = typeof node.kind === 'string' ? PHP8_ONLY_NODES.get(node.kind) : undefined;
	if (reason) found.push({ line: node.loc?.start.line ?? 1, message: `PHP 8 syntax is not allowed: ${reason}` });

	// Constructor promotion: a parameter of __construct with a visibility or readonly modifier (PHP 8.0).
	if (node.kind === 'method' && node.name?.name?.toLowerCase() === '__construct') {
		for (const parameter of node.arguments ?? []) {
			if (parameter.flags) {
				found.push({
					line: parameter.loc?.start.line ?? node.loc?.start.line ?? 1,
					message: 'PHP 8 syntax is not allowed: constructor property promotion (PHP 8.0)',
				});
			}
		}
	}
	// A readonly property or class (PHP 8.1 and 8.2).
	if (node.isReadonly === true || node.readonly === true) {
		found.push({ line: node.loc?.start.line ?? 1, message: 'PHP 8 syntax is not allowed: readonly (PHP 8.1)' });
	}
	// Types that only exist from PHP 8.
	if (node.kind === 'typereference' && typeof node.name === 'string') {
		const typeReason = PHP8_ONLY_TYPES.get(node.name.toLowerCase());
		if (typeReason) found.push({ line: node.loc?.start.line ?? 1, message: `PHP 8 syntax is not allowed: ${typeReason}` });
	}
	// "${var}" is deprecated since PHP 8.2: the plugin must also be clean on 8.3. Write "{$var}".
	if (node.kind === 'encapsedpart' && node.curly === true) {
		found.push({ line: node.loc?.start.line ?? 1, message: 'deprecated since PHP 8.2: "${var}" interpolation, write "{$var}"' });
	}

	for (const key of Object.keys(node)) {
		if (key === 'loc') continue;
		findPhp8Nodes(node[key], found);
	}
}

function main() {
	const targets = process.argv.slice(2).map((argument) => resolve(argument));
	if (targets.length === 0) targets.push(pluginRoot);

	const parser = new Engine({
		parser: { version: '7.4', suppressErrors: false, extractDoc: false },
		ast: { withPositions: true },
	});

	const problems = [];
	let checked = 0;
	for (const target of targets) {
		for (const file of phpFiles(target)) {
			checked += 1;
			const shown = relative(pluginRoot, file).split('\\').join('/');
			try {
				const tree = parser.parseCode(readFileSync(file, 'utf8'), file);
				const found = [];
				findPhp8Nodes(tree, found);
				for (const { line, message } of found) problems.push(`${shown}:${line}: ${message}`);
			} catch (error) {
				const line = typeof error.lineNumber === 'number' ? error.lineNumber : 1;
				const message = String(error.message ?? error).split('\n')[0];
				problems.push(`${shown}:${line}: ${message}`);
			}
		}
	}

	for (const problem of problems) console.error(problem);
	if (problems.length > 0) {
		console.error(`PHP syntax check failed: ${problems.length} problem(s) in ${checked} file(s).`);
		process.exit(1);
	}
	console.log(`PHP syntax check passed: ${checked} file(s) parse as PHP 7.4.`);
}

main();
