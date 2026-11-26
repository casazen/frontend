#!/usr/bin/env node
/**
 * Development tool, not shipped in the plugin ZIP.
 *
 * Builds `dist/casazen-<version>.zip`, the file a person installs from Plugins, Add New, Upload Plugin:
 *
 *   1. refuses to go on when the version strings of the plugin differ (see check-version.mjs);
 *   2. copies the plugin into a temporary folder named `casazen`, leaving out what `.distignore` lists;
 *   3. zips that folder with `archiver`: names with forward slashes, sorted, fixed time stamps and modes, so the same
 *      sources give the same bytes on Windows and on Linux;
 *   4. reads the ZIP back (its central directory) and checks it: ONE top-level folder `casazen/`, the files that must be
 *      there, nothing that must not (tests, tools, node_modules, vendor, composer and package files, dotfiles, keys).
 *
 * It prints the file list and the size. The blocks (`npm run build`) and the translations (`wp i18n make-mo` and
 * `make-json`) are built BEFORE: the check fails when `blocks/build` or the compiled translations are missing. On a machine
 * without WP-CLI, `--allow-missing-translations` skips only the check of the compiled translations.
 *
 * Under GitHub Actions it also writes the step outputs `version` and `zip` (the path of the ZIP).
 *
 * Usage: node tools/build-zip.mjs [--out <folder>] [--allow-missing-translations]
 */
import { appendFileSync, copyFileSync, createWriteStream, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';
import { checkVersions } from './check-version.mjs';

/** The one folder at the top of the ZIP: WordPress installs the plugin in a folder of this name. */
export const TOP_FOLDER = 'casazen';

/** Every entry gets this time stamp and these modes, whatever the machine says. */
const FIXED_DATE = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
const FILE_MODE = 0o644;
const DIRECTORY_MODE = 0o755;

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Files that must be in the ZIP, relative to the top folder. */
const REQUIRED_FILES = ['casazen.php', 'uninstall.php', 'readme.txt', 'license.txt', 'includes/class-plugin.php'];

/** What must never be in the ZIP, by the first name below the top folder. */
const FORBIDDEN_ROOT_NAMES = new Set(['tests', 'tools', 'node_modules', 'vendor', 'dist', 'build', 'README.md', 'phpcs.xml.dist', 'phpunit.xml.dist']);

/** What must never be in the ZIP, wherever it is. */
const FORBIDDEN_NAME = /^(?:\..*|composer\..*|package(?:-lock)?\.json|npm-shrinkwrap\.json|.*\.zip|.*\.log|.*\.(?:pem|key|pfx|p12)|id_rsa.*)$/i;

/**
 * A rule of `.distignore`.
 *
 * @typedef {{ regex: RegExp, anchored: boolean, directoryOnly: boolean, source: string }} DistignoreRule
 */

/** Turns a glob into a regular expression: `*` and `?` stay inside a name, `**` crosses folders. */
function globToRegExp(glob) {
	let source = '';
	for (let index = 0; index < glob.length; index += 1) {
		const character = glob[index];
		if (character === '*') {
			if (glob[index + 1] === '*') {
				if (glob[index + 2] === '/') {
					source += '(?:.*/)?';
					index += 2;
				} else {
					source += '.*';
					index += 1;
				}
			} else {
				source += '[^/]*';
			}
		} else if (character === '?') {
			source += '[^/]';
		} else {
			source += character.replace(/[.+^${}()|[\]\\]/g, '\\$&');
		}
	}
	return new RegExp(`^${source}$`);
}

/**
 * Reads a `.distignore`: one pattern per line, the rules of a `.gitignore` without negation.
 *
 * @param {string} text The content of the file.
 * @returns {DistignoreRule[]}
 */
export function parseDistignore(text) {
	const rules = [];
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (line === '' || line.startsWith('#')) continue;
		if (line.startsWith('!')) throw new Error(`.distignore: a pattern that starts with "!" is not supported: ${line}`);

		let pattern = line;
		const directoryOnly = pattern.endsWith('/');
		if (directoryOnly) pattern = pattern.slice(0, -1);
		const anchored = pattern.startsWith('/') || pattern.includes('/');
		pattern = pattern.replace(/^\//, '');
		rules.push({ regex: globToRegExp(pattern), anchored, directoryOnly, source: line });
	}
	return rules;
}

/**
 * Whether the rules leave a path out of the ZIP.
 *
 * @param {DistignoreRule[]} rules
 * @param {string} relativePath The path below the plugin folder, with forward slashes and no slash at the start.
 * @param {boolean} isDirectory
 */
export function isIgnored(rules, relativePath, isDirectory) {
	const name = relativePath.slice(relativePath.lastIndexOf('/') + 1);
	return rules.some((rule) => {
		if (rule.directoryOnly && !isDirectory) return false;
		return rule.regex.test(rule.anchored ? relativePath : name);
	});
}

/**
 * Lists the files that go into the ZIP, sorted. A folder that a rule leaves out is not entered.
 *
 * @param {string} root The folder of the plugin.
 * @param {DistignoreRule[]} rules
 * @returns {{ rel: string, abs: string }[]}
 */
export function collectFiles(root, rules) {
	const files = [];
	const walk = (folder, prefix) => {
		for (const name of readdirSync(folder).sort()) {
			const abs = join(folder, name);
			const rel = prefix === '' ? name : `${prefix}/${name}`;
			const stats = lstatSync(abs);
			if (stats.isSymbolicLink()) throw new Error(`${rel} is a symbolic link: a ZIP of the plugin must not hold one.`);
			if (stats.isDirectory()) {
				if (!isIgnored(rules, rel, true)) walk(abs, rel);
			} else if (stats.isFile() && !isIgnored(rules, rel, false)) {
				files.push({ rel, abs });
			}
		}
	};
	walk(root, '');
	return files;
}

/**
 * The entries of a ZIP, read from its central directory (the way an installer reads it).
 *
 * @param {string} zipPath
 * @returns {{ name: string, size: number }[]}
 */
export function listZip(zipPath) {
	const buffer = readFileSync(zipPath);
	let end = -1;
	for (let position = buffer.length - 22; position >= Math.max(0, buffer.length - 22 - 65535); position -= 1) {
		if (buffer.readUInt32LE(position) === 0x06054b50) {
			end = position;
			break;
		}
	}
	if (end < 0) throw new Error(`${zipPath} is not a ZIP file: no end of central directory.`);

	const count = buffer.readUInt16LE(end + 10);
	let offset = buffer.readUInt32LE(end + 16);
	const entries = [];
	for (let index = 0; index < count; index += 1) {
		if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error(`${zipPath}: the central directory is damaged at entry ${index}.`);
		const size = buffer.readUInt32LE(offset + 24);
		const nameLength = buffer.readUInt16LE(offset + 28);
		const extraLength = buffer.readUInt16LE(offset + 30);
		const commentLength = buffer.readUInt16LE(offset + 32);
		entries.push({ name: buffer.toString('utf8', offset + 46, offset + 46 + nameLength), size });
		offset += 46 + nameLength + extraLength + commentLength;
	}
	return entries;
}

/**
 * What is wrong with the entries of a ZIP of the plugin. An empty list means it is good.
 *
 * @param {{ name: string }[]} entries The entries of the ZIP.
 * @param {object} [options]
 * @param {string[]} [options.blocks] The names of the blocks: each needs `blocks/build/<name>/block.json` and `index.js`.
 * @param {boolean} [options.requireTranslations] Whether compiled translations (`.mo` and `.json`) must be in `languages/`.
 * @returns {string[]}
 */
export function verifyEntries(entries, { blocks = [], requireTranslations = true } = {}) {
	const problems = [];
	const names = entries.map((entry) => entry.name);
	const prefix = `${TOP_FOLDER}/`;

	const outside = names.filter((name) => !name.startsWith(prefix));
	if (outside.length > 0) problems.push(`The ZIP must have ONE top-level folder "${prefix}", but it holds: ${outside.slice(0, 5).join(', ')}.`);

	const inside = names.filter((name) => name.startsWith(prefix)).map((name) => name.slice(prefix.length));
	const files = new Set(inside);

	for (const required of REQUIRED_FILES) {
		if (!files.has(required)) problems.push(`The ZIP has no ${prefix}${required}.`);
	}
	for (const block of blocks) {
		for (const file of ['block.json', 'index.js']) {
			if (!files.has(`blocks/build/${block}/${file}`)) problems.push(`The ZIP has no ${prefix}blocks/build/${block}/${file}: run "npm run build" first.`);
		}
	}
	if (requireTranslations) {
		const languages = inside.filter((name) => name.startsWith('languages/'));
		if (!languages.some((name) => name.endsWith('.mo'))) problems.push(`The ZIP has no compiled translation (languages/*.mo): run "wp i18n make-mo languages" first.`);
		if (!languages.some((name) => name.endsWith('.json'))) problems.push(`The ZIP has no translation for the editor (languages/*.json): run "wp i18n make-json languages --no-purge" first.`);
	}

	for (const path of inside) {
		const segments = path.split('/').filter((segment) => segment !== '');
		if (segments.length === 0) continue;
		if (FORBIDDEN_ROOT_NAMES.has(segments[0]) || (segments[0] === 'blocks' && segments[1] === 'src')) {
			problems.push(`${prefix}${path} must not be in the ZIP: it is a development file.`);
		} else if (segments.some((segment) => FORBIDDEN_NAME.test(segment))) {
			problems.push(`${prefix}${path} must not be in the ZIP: it is a dotfile, a package or composer file, a log, a key or another ZIP.`);
		}
	}
	return problems;
}

/** The names of the blocks, from `blocks/src/<name>/block.json`. */
export function blockNames(root) {
	const source = join(root, 'blocks', 'src');
	if (!existsSync(source)) return [];
	return readdirSync(source, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && existsSync(join(source, entry.name, 'block.json')))
		.map((entry) => entry.name)
		.sort();
}

/**
 * Builds the ZIP and checks it.
 *
 * @param {object} [options]
 * @param {string} [options.root] The folder of the plugin.
 * @param {string} [options.outDir] Where `casazen-<version>.zip` is written. Default: `<root>/dist`.
 * @param {boolean} [options.allowMissingTranslations] Do not require the compiled translations.
 * @returns {Promise<{ zipPath: string, version: string, entries: { name: string, size: number }[], bytes: number }>}
 */
export async function buildZip({ root = PLUGIN_ROOT, outDir = resolve(root, 'dist'), allowMissingTranslations = false } = {}) {
	const { ok, version, problems } = checkVersions({ root });
	if (!ok || version === null) throw new Error(`The version of the plugin is not one string:\n  ${problems.join('\n  ')}`);

	const distignore = resolve(root, '.distignore');
	if (!existsSync(distignore)) throw new Error(`${distignore} does not exist: it lists what stays out of the ZIP.`);
	const rules = parseDistignore(readFileSync(distignore, 'utf8'));
	const files = collectFiles(root, rules);

	const staging = mkdtempSync(join(tmpdir(), 'casazen-zip-'));
	try {
		// The plugin, minus what .distignore lists, in a folder named like the plugin.
		const stage = join(staging, TOP_FOLDER);
		mkdirSync(stage, { recursive: true });
		for (const { rel, abs } of files) {
			const target = join(stage, ...rel.split('/'));
			mkdirSync(dirname(target), { recursive: true });
			copyFileSync(abs, target);
		}

		// Every entry: the top folder, each folder that holds a file, each file. Sorted by name.
		const directories = new Set([TOP_FOLDER]);
		for (const { rel } of files) {
			const parts = rel.split('/');
			for (let depth = 1; depth < parts.length; depth += 1) directories.add(`${TOP_FOLDER}/${parts.slice(0, depth).join('/')}`);
		}
		const entries = [
			...[...directories].map((name) => ({ name: `${name}/`, directory: true })),
			...files.map(({ rel }) => ({ name: `${TOP_FOLDER}/${rel}`, directory: false })),
		].sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

		mkdirSync(outDir, { recursive: true });
		const zipPath = resolve(outDir, `casazen-${version}.zip`);
		rmSync(zipPath, { force: true });

		const archive = new ZipArchive({ zlib: { level: 9 } });
		const written = pipeline(archive, createWriteStream(zipPath));
		for (const entry of entries) {
			if (entry.directory) {
				archive.append('', { name: entry.name, date: FIXED_DATE, mode: DIRECTORY_MODE, type: 'directory' });
			} else {
				const source = readFileSync(join(staging, ...entry.name.split('/')));
				archive.append(source, { name: entry.name, date: FIXED_DATE, mode: FILE_MODE });
			}
		}
		await Promise.all([archive.finalize(), written]);

		// Read the ZIP back, as an installer does, and check what is in it.
		const listed = listZip(zipPath);
		const wrong = verifyEntries(listed, { blocks: blockNames(root), requireTranslations: !allowMissingTranslations });
		if (wrong.length > 0) {
			rmSync(zipPath, { force: true });
			throw new Error(`The ZIP is not good:\n  ${wrong.join('\n  ')}`);
		}
		return { zipPath, version, entries: listed, bytes: readFileSync(zipPath).length };
	} finally {
		rmSync(staging, { recursive: true, force: true });
	}
}

function formatSize(bytes) {
	return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KiB`;
}

async function main() {
	const argv = process.argv.slice(2);
	let outDir;
	let allowMissingTranslations = false;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === '--allow-missing-translations') {
			allowMissingTranslations = true;
		} else if (argument === '--out') {
			outDir = resolve(argv[(index += 1)] ?? '');
		} else if (argument.startsWith('--out=')) {
			outDir = resolve(argument.slice('--out='.length));
		} else {
			console.error(`Unknown argument: ${argument}. Usage: node tools/build-zip.mjs [--out <folder>] [--allow-missing-translations]`);
			process.exit(2);
		}
	}

	let result;
	try {
		result = await buildZip({ outDir, allowMissingTranslations });
	} catch (error) {
		console.error(`build-zip: ${error.message}`);
		process.exit(1);
	}

	const { zipPath, version, entries, bytes } = result;
	const files = entries.filter((entry) => !entry.name.endsWith('/'));
	for (const entry of entries) {
		console.log(`${entry.name.endsWith('/') ? '       dir' : formatSize(entry.size).padStart(10)}  ${entry.name}`);
	}
	const uncompressed = files.reduce((sum, entry) => sum + entry.size, 0);
	console.log(`build-zip: ${files.length} files, ${formatSize(uncompressed)} unpacked, one top-level folder "${TOP_FOLDER}/".`);
	console.log(`build-zip: ${relative(process.cwd(), zipPath).split(sep).join('/') || zipPath} (${formatSize(bytes)}), plugin version ${version}.`);

	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nzip=${zipPath}\n`);
	}
}

// Run as a command, not when a test imports the functions (by file name: a path written another way never skips it).
if (basename(process.argv[1] ?? '') === 'build-zip.mjs') {
	await main();
}
