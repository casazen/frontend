#!/usr/bin/env node
/**
 * Development tool, not shipped in the plugin ZIP.
 *
 * Builds `dist/casazen-<version>.zip`, the file a person installs from Plugins, Add New, Upload Plugin:
 *
 *   1. refuses to go on when the version strings of the plugin differ (see check-version.mjs);
 *   2. copies the plugin into a temporary folder named `casazen`, leaving out what `.distignore` lists;
 *   3. with `--app-origin`, writes `includes/build-config.php` into that folder: the address of the CasaZen console of the
 *      environment the ZIP is for (the test console for the test ZIP, the production one for the production ZIP). The file is
 *      generated for the ZIP only: it is never in the sources, and the build refuses a folder that holds one;
 *   4. zips that folder with `archiver`: names with forward slashes, sorted, fixed time stamps and modes, so the same
 *      sources give the same bytes on Windows and on Linux;
 *   5. reads the ZIP back (its central directory) and checks it: ONE top-level folder `casazen/`, the files that must be
 *      there, nothing that must not (tests, tools, node_modules, vendor, composer and package files, dotfiles, keys), and
 *      `includes/build-config.php` there with exactly that address when `--app-origin` was given, and not there otherwise.
 *
 * It prints the file list and the size. The blocks (`npm run build`) and the translations (`wp i18n make-mo` and
 * `make-json`) are built BEFORE: the check fails when `blocks/build` or the compiled translations are missing, and when the
 * ZIP lacks the file that WordPress asks for to translate the editor script of a block (see check-translations.mjs). On a machine
 * without WP-CLI, `--allow-missing-translations` skips only the check of the compiled translations.
 *
 * Under GitHub Actions it also writes the step outputs `version` and `zip` (the path of the ZIP).
 *
 * Usage: node tools/build-zip.mjs [--out <folder>] [--allow-missing-translations] [--app-origin <https origin>]
 */
import { appendFileSync, copyFileSync, createWriteStream, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { builtBlockScripts, readTextDomain, scriptTranslationFileName } from './check-translations.mjs';
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
 * The file that carries the address of the CasaZen console, below the plugin folder. It exists in the ZIP only, and only when `--app-origin`
 * was given: the plugin reads it (`return array( 'app_origin' => '<origin>' );`) to know which environment it was downloaded for.
 */
export const BUILD_CONFIG_PATH = 'includes/build-config.php';

/** An `https` host name (letters, digits and hyphens in each label, no underscore, no IP address) and an optional port. */
const APP_ORIGIN_PATTERN = /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?::\d{1,5})?$/;

/**
 * Checks the address of a CasaZen console and returns it: an `https` origin and nothing else.
 *
 * It must be written in its canonical form (lowercase host, no default port, no trailing slash), so that what goes into the PHP file is
 * exactly what the URL parser calls the origin, and cannot carry a character that needs escaping.
 *
 * @param {unknown} value The text given to `--app-origin`.
 * @returns {string} The origin, for example `https://www.casazen.space`.
 * @throws {Error} With a message that says what to write instead.
 */
export function parseAppOrigin(value) {
	const shown = typeof value === 'string' ? value : String(value);
	if (typeof value !== 'string' || value.trim() === '') {
		throw new Error(`--app-origin is empty: write the origin of the CasaZen console, for example https://www.casazen.space.`);
	}

	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`--app-origin "${shown}" is not a URL: write the origin of the CasaZen console, for example https://www.casazen.space.`);
	}
	if (url.protocol === 'http:') {
		throw new Error(`--app-origin "${shown}" is an http address: the plugin only talks to the console over https.`);
	}
	if (url.protocol !== 'https:') {
		throw new Error(`--app-origin "${shown}" is not an https address: write the origin of the CasaZen console, for example https://www.casazen.space.`);
	}
	if (url.username !== '' || url.password !== '') {
		throw new Error(`--app-origin "${shown}" holds credentials: an origin is the scheme, the host and the port, nothing else.`);
	}
	if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
		throw new Error(`--app-origin "${shown}" has a path, a query or a fragment: write the origin only, ${url.origin}.`);
	}
	if (url.hostname.startsWith('[') || /^[0-9.]+$/.test(url.hostname)) {
		throw new Error(`--app-origin "${shown}" is an IP address: the address of the console is a host name.`);
	}
	if (value !== url.origin) {
		throw new Error(`--app-origin "${shown}" is not written as an origin: write it as ${url.origin} (lowercase host, no default port, no trailing slash).`);
	}
	if (!APP_ORIGIN_PATTERN.test(url.origin)) {
		throw new Error(`--app-origin "${shown}" is not an https address with a plain host name (letters, digits and hyphens in each label).`);
	}
	return url.origin;
}

/**
 * The text of `includes/build-config.php`, written with the quoting of the plugin's PHP standard (WordPress coding standards: single quotes,
 * spaces inside the parentheses, a file comment) and valid on PHP 7.4. The line `return array( ... );` is what the plugin reads.
 *
 * @param {string} appOrigin The origin of the console (checked again here: the file is only ever written for a valid one).
 * @returns {string}
 */
export function buildConfigPhp(appOrigin) {
	const origin = parseAppOrigin(appOrigin);
	const quoted = `'${origin.replace(/[\\']/g, '\\$&')}'`;
	return [
		'<?php',
		'/**',
		' * The address of the CasaZen console this package was built for.',
		' *',
		' * Written into the ZIP by tools/build-zip.mjs (--app-origin). It is generated: it is not in the repository',
		' * and it is not edited by hand.',
		' *',
		' * @package Casazen',
		' */',
		'',
		"defined( 'ABSPATH' ) || exit;",
		'',
		`return array( 'app_origin' => ${quoted} );`,
		'',
	].join('\n');
}

/**
 * The address inside a `build-config.php` that `buildConfigPhp()` wrote.
 *
 * @param {string} text The content of the file.
 * @returns {string | null} The origin, or null when the file is not what the generator writes.
 */
export function readBuildConfigOrigin(text) {
	const match = /^return array\( 'app_origin' => '([^'\\]*)' \);\r?$/m.exec(text);
	return match ? match[1] : null;
}

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

/** The central directory of a ZIP: where each entry is and how it is stored. */
function readCentralDirectory(buffer, zipPath) {
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
		const method = buffer.readUInt16LE(offset + 10);
		const compressedSize = buffer.readUInt32LE(offset + 20);
		const size = buffer.readUInt32LE(offset + 24);
		const nameLength = buffer.readUInt16LE(offset + 28);
		const extraLength = buffer.readUInt16LE(offset + 30);
		const commentLength = buffer.readUInt16LE(offset + 32);
		const localOffset = buffer.readUInt32LE(offset + 42);
		entries.push({ name: buffer.toString('utf8', offset + 46, offset + 46 + nameLength), size, method, compressedSize, localOffset });
		offset += 46 + nameLength + extraLength + commentLength;
	}
	return entries;
}

/**
 * The entries of a ZIP, read from its central directory (the way an installer reads it).
 *
 * @param {string} zipPath
 * @returns {{ name: string, size: number }[]}
 */
export function listZip(zipPath) {
	return readCentralDirectory(readFileSync(zipPath), zipPath).map(({ name, size }) => ({ name, size }));
}

/**
 * The content of one file of a ZIP, read the way an installer reads it: from the central directory to the local header to the data.
 *
 * @param {string} zipPath
 * @param {string} name The name of the entry, with forward slashes (`casazen/includes/build-config.php`).
 * @returns {Buffer | null} The bytes, or null when the ZIP has no entry of that name.
 */
export function readZipEntry(zipPath, name) {
	const buffer = readFileSync(zipPath);
	const entry = readCentralDirectory(buffer, zipPath).find((candidate) => candidate.name === name);
	if (entry === undefined) return null;

	const { localOffset, compressedSize, method } = entry;
	if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`${zipPath}: the local header of ${name} is damaged.`);
	const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
	const data = buffer.subarray(start, start + compressedSize);
	if (method === 0) return Buffer.from(data);
	if (method === 8) return inflateRawSync(data);
	throw new Error(`${zipPath}: ${name} is stored with the method ${method}, which this tool does not read.`);
}

/**
 * What is wrong with the entries of a ZIP of the plugin. An empty list means it is good.
 *
 * @param {{ name: string }[]} entries The entries of the ZIP.
 * @param {object} [options]
 * @param {string[]} [options.blocks] The names of the blocks: each needs `blocks/build/<name>/block.json` and `index.js`.
 * @param {boolean} [options.requireTranslations] Whether compiled translations (`.mo` and `.json`) must be in `languages/`.
 * @param {string[]} [options.scripts] The scripts of the built blocks, as paths below the plugin folder (`blocks/build/booking/index.js`):
 *   with `requireTranslations`, the ZIP must hold, for each of them and each language it ships, the JSON file that WordPress asks for.
 * @param {string} [options.domain] The text domain of the plugin (the prefix of the files of `languages/`).
 * @param {string | null} [options.appOrigin] The address of the console the ZIP was built for: with it, `includes/build-config.php` must be in
 *   the ZIP; without it (the default), it must not be there.
 * @returns {string[]}
 */
export function verifyEntries(entries, { blocks = [], requireTranslations = true, scripts = [], domain = TOP_FOLDER, appOrigin = null } = {}) {
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
	if (appOrigin !== null && !files.has(BUILD_CONFIG_PATH)) {
		problems.push(`The ZIP has no ${prefix}${BUILD_CONFIG_PATH}, which must hold the address of the console, ${appOrigin}.`);
	}
	if (appOrigin === null && files.has(BUILD_CONFIG_PATH)) {
		problems.push(`The ZIP has ${prefix}${BUILD_CONFIG_PATH} but no --app-origin was given: that file is generated for the ZIP, never taken from the sources.`);
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

		// A JSON file is only loaded under the name WordPress asks for: `<domain>-<locale>-<md5 of the path of the built script>.json`.
		// `wp i18n make-json` takes that md5 from the path that the catalog cites, so a catalog that cites other paths gives files that
		// are in the ZIP and never loaded: the texts of the editor stay in English and nothing else says so.
		const catalogPrefix = `languages/${domain}-`;
		const locales = [...new Set(inside.filter((name) => name.startsWith(catalogPrefix) && (name.endsWith('.mo') || name.endsWith('.po'))).map((name) => name.slice(catalogPrefix.length, -'.mo'.length)))].sort();
		for (const locale of locales) {
			for (const script of scripts) {
				const file = `languages/${scriptTranslationFileName(domain, locale, script)}`;
				if (!files.has(file)) {
					problems.push(`The ZIP has no ${prefix}${file}: WordPress asks for it to translate ${script} into ${locale}, and "wp i18n make-json" names it after the md5 of the path that the catalog cites (see tools/check-translations.mjs).`);
				}
			}
		}
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

/**
 * Reads `includes/build-config.php` back from a ZIP and checks that it is exactly what the generator writes for `appOrigin`.
 *
 * @param {string} zipPath
 * @param {string} appOrigin The address of the console the ZIP must carry.
 * @returns {string[]} What is wrong; an empty list means the ZIP carries that address.
 */
export function verifyBuildConfig(zipPath, appOrigin) {
	const name = `${TOP_FOLDER}/${BUILD_CONFIG_PATH}`;
	const content = readZipEntry(zipPath, name);
	if (content === null) return [`The ZIP has no ${name}, which must hold the address of the console, ${appOrigin}.`];
	if (content.toString('utf8') !== buildConfigPhp(appOrigin)) {
		const found = readBuildConfigOrigin(content.toString('utf8'));
		return [`${name} does not hold the address ${appOrigin}${found === null ? ': it is not what tools/build-zip.mjs writes' : `: it holds ${found}`}.`];
	}
	return [];
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
 * @param {string | null} [options.appOrigin] The address of the CasaZen console of the environment the ZIP is for (an `https` origin). With it,
 *   the ZIP holds `includes/build-config.php` with that address; without it, the ZIP has no such file. The working tree never does.
 * @returns {Promise<{ zipPath: string, version: string, entries: { name: string, size: number }[], bytes: number, appOrigin: string | null }>}
 */
export async function buildZip({ root = PLUGIN_ROOT, outDir = resolve(root, 'dist'), allowMissingTranslations = false, appOrigin = null } = {}) {
	// First of all: a wrong address stops the build before anything is read or written.
	const origin = appOrigin === null || appOrigin === undefined ? null : parseAppOrigin(appOrigin);

	const { ok, version, problems } = checkVersions({ root });
	if (!ok || version === null) throw new Error(`The version of the plugin is not one string:\n  ${problems.join('\n  ')}`);

	const distignore = resolve(root, '.distignore');
	if (!existsSync(distignore)) throw new Error(`${distignore} does not exist: it lists what stays out of the ZIP.`);
	const rules = parseDistignore(readFileSync(distignore, 'utf8'));
	const collected = collectFiles(root, rules);
	if (collected.some(({ rel }) => rel === BUILD_CONFIG_PATH)) {
		throw new Error(`${BUILD_CONFIG_PATH} is in the plugin folder: that file is written into the ZIP by --app-origin and must never be in the sources. Remove it.`);
	}

	const staging = mkdtempSync(join(tmpdir(), 'casazen-zip-'));
	try {
		// The plugin, minus what .distignore lists, in a folder named like the plugin.
		const stage = join(staging, TOP_FOLDER);
		mkdirSync(stage, { recursive: true });
		for (const { rel, abs } of collected) {
			const target = join(stage, ...rel.split('/'));
			mkdirSync(dirname(target), { recursive: true });
			copyFileSync(abs, target);
		}

		// The address of the console: generated here, into the staging folder, so it is in the ZIP and never in the working tree.
		const files = [...collected];
		if (origin !== null) {
			const target = join(stage, ...BUILD_CONFIG_PATH.split('/'));
			mkdirSync(dirname(target), { recursive: true });
			writeFileSync(target, buildConfigPhp(origin));
			files.push({ rel: BUILD_CONFIG_PATH, abs: target });
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

		// Loaded here, not at the top: publish-release.mjs and a command that refuses a wrong --app-origin import this file and never zip.
		const { ZipArchive } = await import('archiver');
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
		const wrong = verifyEntries(listed, {
			blocks: blockNames(root),
			requireTranslations: !allowMissingTranslations,
			scripts: builtBlockScripts(root).map(({ script }) => script),
			domain: readTextDomain(root) ?? TOP_FOLDER,
			appOrigin: origin,
		});
		// With an address: the file is in the ZIP and holds exactly that address (read back from the ZIP, not from the staging folder).
		if (origin !== null && wrong.length === 0) wrong.push(...verifyBuildConfig(zipPath, origin));
		if (wrong.length > 0) {
			rmSync(zipPath, { force: true });
			throw new Error(`The ZIP is not good:\n  ${wrong.join('\n  ')}`);
		}
		return { zipPath, version, entries: listed, bytes: readFileSync(zipPath).length, appOrigin: origin };
	} finally {
		rmSync(staging, { recursive: true, force: true });
	}
}

function formatSize(bytes) {
	return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KiB`;
}

const USAGE = 'node tools/build-zip.mjs [--out <folder>] [--allow-missing-translations] [--app-origin <https origin>]';

async function main() {
	const argv = process.argv.slice(2);
	let outDir;
	let allowMissingTranslations = false;
	let appOrigin = null;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === '--allow-missing-translations') {
			allowMissingTranslations = true;
		} else if (argument === '--out') {
			outDir = resolve(argv[(index += 1)] ?? '');
		} else if (argument.startsWith('--out=')) {
			outDir = resolve(argument.slice('--out='.length));
		} else if (argument === '--app-origin' || argument.startsWith('--app-origin=')) {
			const value = argument === '--app-origin' ? argv[(index += 1)] : argument.slice('--app-origin='.length);
			try {
				appOrigin = parseAppOrigin(value);
			} catch (error) {
				// Before anything is built: a wrong address is a mistake of the command, not of the plugin.
				console.error(`build-zip: ${error.message}`);
				process.exit(2);
			}
		} else {
			console.error(`Unknown argument: ${argument}. Usage: ${USAGE}`);
			process.exit(2);
		}
	}

	let result;
	try {
		result = await buildZip({ outDir, allowMissingTranslations, appOrigin });
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
	console.log(
		appOrigin === null
			? `build-zip: no --app-origin, so the ZIP has no ${BUILD_CONFIG_PATH}.`
			: `build-zip: ${BUILD_CONFIG_PATH} holds the address of the console, ${appOrigin} (read back from the ZIP).`
	);
	console.log(`build-zip: ${relative(process.cwd(), zipPath).split(sep).join('/') || zipPath} (${formatSize(bytes)}), plugin version ${version}.`);

	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nzip=${zipPath}\n`);
	}
}

// Run as a command, not when a test imports the functions (by file name: a path written another way never skips it).
if (basename(process.argv[1] ?? '') === 'build-zip.mjs') {
	await main();
}
