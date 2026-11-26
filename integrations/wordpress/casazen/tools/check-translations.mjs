#!/usr/bin/env node
/**
 * Development tool, not shipped in the plugin ZIP.
 *
 * The proof that the texts of the block editor are found by WordPress.
 *
 * The editor script of a block (`blocks/build/<block>/index.js`) is translated in the browser: WordPress asks the server for
 * `languages/<domain>-<locale>-<md5>.json`, where <md5> is the md5 of the path of THE BUILT SCRIPT below the plugin folder
 * (`load_script_textdomain()` in wp-includes/l10n.php: the path of the script URL without the plugin folder, `x.min.js` read as
 * `x.js`). `wp i18n make-json` writes those files, and names each one after the md5 of the script path that the catalog (the `.po`)
 * cites for a text. When the two paths differ, for example when the catalog cites the sources (`blocks/src/...`) and not the build,
 * the file exists but WordPress never asks for it, and the editor stays in English on an Italian site: nothing fails, nothing warns.
 *
 * This tool computes the names the way WordPress does, from the BUILT blocks (`blocks/build/<block>/block.json`), and checks `languages/`
 * after `wp i18n make-mo` and `wp i18n make-json --no-purge`: for every editor script of a built block and every language that the
 * plugin ships (`languages/<domain>-<locale>.po`) the file must be there, be the JSON that make-json writes, and hold every translated
 * text that the catalog cites for that script. WP-CLI exists only in CI, so on a machine without it the proof is `npm run test:tools`.
 *
 * Output: one line per problem on stderr. Exit code 1 when a file is missing or wrong, 0 otherwise.
 *
 * Usage: node tools/check-translations.mjs [--root <folder of the plugin>]
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Where `npm run build` writes the blocks (`--output-path=blocks/build`), below the plugin folder. */
export const BUILD_FOLDER = 'blocks/build';

/**
 * The fields of `block.json` whose scripts get the translations of the plugin: Blocks::register() in PHP calls
 * wp_set_script_translations() for the `editor_script_handles` of each block, and for no other script. A block with a script
 * for the front end that has texts needs that call too, and its field here.
 */
const SCRIPT_FIELDS = ['editorScript'];

/** The separator of a context and a text in the key of a translation (the end-of-transmission character of the Jed format). */
const CONTEXT_SEPARATOR = '\u0004';

function md5(text) {
	return createHash('md5').update(text).digest('hex');
}

/**
 * The path that WordPress and `wp i18n make-json` hash: translations are always based on the unminified file name.
 *
 * @param {string} script The path of a script below the plugin folder, with forward slashes (`blocks/build/booking/index.js`).
 * @returns {string}
 */
export function unminifiedScript(script) {
	return script.endsWith('.min.js') ? `${script.slice(0, -'.min.js'.length)}.js` : script;
}

/**
 * The name of the file with the translations of one script, as `load_script_textdomain()` of WordPress asks for it:
 * `<domain>-<locale>-<md5 of the path of the script below the plugin folder>.json`.
 *
 * @param {string} domain The text domain (`casazen`).
 * @param {string} locale The locale of the site or the user (`it_IT`).
 * @param {string} script The path of the script below the plugin folder, with forward slashes and no slash at the start.
 * @returns {string}
 */
export function scriptTranslationFileName(domain, locale, script) {
	return `${domain}-${locale}-${md5(unminifiedScript(script))}.json`;
}

/**
 * The text domain of the plugin: the `Text Domain:` header of casazen.php.
 *
 * @param {string} root The folder of the plugin.
 * @returns {string | null}
 */
export function readTextDomain(root = PLUGIN_ROOT) {
	const main = readFileSync(resolve(root, 'casazen.php'), 'utf8');
	const headerEnd = main.indexOf('*/');
	const header = headerEnd >= 0 ? main.slice(0, headerEnd + 2) : main.slice(0, 8192);
	const match = /^[ \t]*\*?[ \t]*Text Domain:[ \t]*(\S+)[ \t]*\r?$/m.exec(header);
	return match ? match[1] : null;
}

/**
 * The editor scripts of the built blocks: the files that the `editorScript` field of `blocks/build/<block>/block.json` names
 * with `file:`, as paths below the plugin folder.
 *
 * @param {string} root The folder of the plugin.
 * @returns {{ block: string, field: string, script: string, exists: boolean }[]} Sorted by block. Empty when nothing was built.
 */
export function builtBlockScripts(root = PLUGIN_ROOT) {
	const build = join(root, ...BUILD_FOLDER.split('/'));
	if (!existsSync(build)) return [];

	const scripts = [];
	const folders = readdirSync(build, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	for (const block of folders) {
		const file = join(build, block, 'block.json');
		if (!existsSync(file)) continue;

		let metadata;
		try {
			metadata = JSON.parse(readFileSync(file, 'utf8'));
		} catch (error) {
			throw new Error(`${BUILD_FOLDER}/${block}/block.json is not valid JSON: ${error.message}`);
		}
		for (const field of SCRIPT_FIELDS) {
			for (const value of [].concat(metadata[field] ?? [])) {
				if (typeof value !== 'string' || !value.startsWith('file:')) continue;
				const script = posix.normalize(posix.join(BUILD_FOLDER, block, value.slice('file:'.length)));
				scripts.push({ block, field, script, exists: existsSync(join(root, ...script.split('/'))) });
			}
		}
	}
	return scripts;
}

/** The text of a quoted string of a `.po` file, without the quotes and with the escapes read. */
function unquote(quoted) {
	return quoted
		.slice(1, -1)
		.replace(/\\(["\\ntr])/g, (_whole, character) => ({ n: '\n', t: '\t', r: '\r' })[character] ?? character);
}

/**
 * Reads a `.po` (or `.pot`) catalog.
 *
 * @param {string} text The content of the file.
 * @returns {{ context: string | undefined, id: string, strings: string[], references: string[] }[]} The entries, header excluded:
 *   `strings` holds the translation (one string, or one per plural form) and `references` the files that the entry cites, without
 *   the line numbers.
 */
export function parsePo(text) {
	const entries = [];
	let entry = null;
	let field = null;

	const flush = () => {
		if (entry && entry.id !== undefined && entry.id !== '') {
			entries.push({ context: entry.context, id: entry.id, strings: entry.strings, references: entry.references });
		}
		entry = null;
		field = null;
	};
	const begin = () => {
		entry ??= { context: undefined, id: undefined, strings: [], references: [] };
		return entry;
	};

	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (line === '') {
			flush();
		} else if (line.startsWith('#~')) {
			// An obsolete entry: WordPress never reads it.
			continue;
		} else if (line.startsWith('#')) {
			// A comment after the translation of an entry starts the next one.
			if (entry && entry.strings.length > 0) flush();
			if (line.startsWith('#:')) {
				begin().references.push(...line.slice(2).trim().split(/\s+/).filter(Boolean).map((reference) => reference.replace(/:\d+$/, '')));
			} else {
				begin();
			}
		} else {
			const match = /^(msgctxt|msgid_plural|msgid|msgstr)(?:\[(\d+)\])?[ \t]+("(?:[^"\\]|\\.)*")$/.exec(line);
			if (match) {
				const [, keyword, index, quoted] = match;
				const value = unquote(quoted);
				// `msgid` or `msgctxt` after a translation: an entry without blank line before it.
				if ((keyword === 'msgid' || keyword === 'msgctxt') && entry && entry.strings.length > 0) flush();
				const current = begin();
				if (keyword === 'msgctxt') {
					current.context = value;
					field = { kind: 'context' };
				} else if (keyword === 'msgid') {
					current.id = value;
					field = { kind: 'id' };
				} else if (keyword === 'msgid_plural') {
					field = { kind: 'plural' };
				} else {
					const position = index === undefined ? 0 : Number(index);
					current.strings[position] = value;
					field = { kind: 'string', position };
				}
			} else if (line.startsWith('"') && entry && field) {
				// The continuation of the previous string.
				const value = unquote(line);
				if (field.kind === 'context') entry.context += value;
				else if (field.kind === 'id') entry.id += value;
				else if (field.kind === 'string') entry.strings[field.position] += value;
			}
		}
	}
	flush();
	return entries;
}

/** The `.js` file that a reference of a catalog is, read the way `wp i18n make-json` reads it, or null when it is not a script. */
function scriptOfReference(reference) {
	return reference.endsWith('.js') ? unminifiedScript(reference) : null;
}

/**
 * The locales that the plugin ships: the `<domain>-<locale>.po` files of `languages/`.
 *
 * @param {string} root The folder of the plugin.
 * @param {string} domain The text domain.
 * @returns {string[]} For example `['it_IT']`.
 */
export function catalogLocales(root, domain) {
	const languages = join(root, 'languages');
	if (!existsSync(languages)) return [];
	return readdirSync(languages)
		.filter((name) => name.startsWith(`${domain}-`) && name.endsWith('.po'))
		.map((name) => name.slice(domain.length + 1, -'.po'.length))
		.sort();
}

/** What is wrong with one translation file of a script. An empty list means it is good. */
function problemsOfFile({ root, location, script, poPath, entries, domain }) {
	let data;
	try {
		data = JSON.parse(readFileSync(join(root, location), 'utf8'));
	} catch (error) {
		return [`${location} is not valid JSON (${error.message}): it is not what "wp i18n make-json" writes.`];
	}

	const messages = data?.locale_data?.messages ?? data?.locale_data?.[domain];
	if (messages === null || typeof messages !== 'object') {
		return [`${location} has no locale_data.messages: it is not what "wp i18n make-json" writes.`];
	}

	const problems = [];
	if (typeof data.source === 'string' && unminifiedScript(data.source) !== script) {
		problems.push(`${location} says it holds the texts of ${data.source}, but its name is the one of ${script}.`);
	}

	const lacking = [];
	for (const entry of entries) {
		if (!entry.references.some((reference) => scriptOfReference(reference) === script)) continue;
		if (!entry.strings.some((text) => text !== '')) continue;
		const key = entry.context === undefined ? entry.id : `${entry.context}${CONTEXT_SEPARATOR}${entry.id}`;
		const found = messages[key];
		if (!Array.isArray(found) || found.length !== entry.strings.length || found.some((text, index) => text !== entry.strings[index])) {
			lacking.push(entry.id);
		}
	}
	if (lacking.length > 0) {
		problems.push(
			`${location} lacks ${lacking.length} translated text(s) that ${poPath} cites for ${script}, for example "${lacking[0]}": run "wp i18n make-mo languages" and "wp i18n make-json languages --no-purge" again.`
		);
	}
	return problems;
}

/**
 * Checks `languages/` after the translations were compiled: for each script of a built block and each shipped language, the file that
 * WordPress asks for is there and holds the texts of the catalog.
 *
 * @param {object} [options]
 * @param {string} [options.root] The folder of the plugin.
 * @returns {{ ok: boolean, problems: string[], checked: string[] }} `checked` has one line per script and language that is good.
 */
export function checkTranslations({ root = PLUGIN_ROOT } = {}) {
	const problems = [];
	const checked = [];

	const domain = readTextDomain(root);
	if (domain === null) {
		return { ok: false, problems: ['Could not read the Text Domain header of casazen.php.'], checked };
	}

	const scripts = builtBlockScripts(root);
	if (scripts.length === 0) {
		problems.push(`${BUILD_FOLDER} holds no built block (no block.json with a script): run "npm run build" first.`);
	}
	for (const { block, field, script, exists } of scripts) {
		if (!exists) problems.push(`${BUILD_FOLDER}/${block}/block.json names ${script} as its ${field}, but the file was not built.`);
	}

	const locales = catalogLocales(root, domain);
	if (locales.length === 0) {
		problems.push(`languages/ holds no ${domain}-<locale>.po catalog: there is nothing to translate the block editor with.`);
	}

	const languages = join(root, 'languages');
	for (const locale of locales) {
		const poPath = `languages/${domain}-${locale}.po`;
		const entries = parsePo(readFileSync(join(root, poPath), 'utf8'));
		const cited = [...new Set(entries.flatMap((entry) => entry.references.map(scriptOfReference).filter(Boolean)))];

		const asked = new Set();
		const before = problems.length;
		for (const { script } of scripts) {
			const file = scriptTranslationFileName(domain, locale, script);
			const location = `languages/${file}`;
			asked.add(file);

			if (!existsSync(join(root, location))) {
				const why = cited.includes(script)
					? `${poPath} does cite it, so "wp i18n make-json languages --no-purge" has not run since the catalog or the build changed`
					: `${poPath} cites ${cited.length > 0 ? cited.join(', ') : 'no script'}, and "wp i18n make-json" names each file after the md5 of the path that the catalog cites, so the catalog must cite ${script}`;
				problems.push(`${location} is missing: WordPress asks for it to translate ${script} into ${locale}; ${why}.`);
				continue;
			}

			const wrong = problemsOfFile({ root, location, script, poPath, entries, domain });
			if (wrong.length > 0) {
				problems.push(...wrong);
			} else {
				checked.push(`${locale}: ${script} is translated by ${location}`);
			}
		}

		// The files that nobody asks for: the sign of a catalog that cites the wrong paths, said once next to the missing files of the language.
		const prefix = `${domain}-${locale}-`;
		const unused = readdirSync(languages).filter((name) => name.startsWith(prefix) && name.endsWith('.json') && !asked.has(name));
		if (unused.length > 0 && problems.length > before) {
			problems.push(`languages/ holds ${unused.join(', ')} for ${locale}, which no built script of the plugin asks for: WordPress never loads ${unused.length === 1 ? 'it' : 'them'}.`);
		}
	}

	return { ok: problems.length === 0, problems, checked };
}

function main() {
	const argv = process.argv.slice(2);
	let root = PLUGIN_ROOT;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === '--root') {
			root = resolve(argv[(index += 1)] ?? '');
		} else if (argument.startsWith('--root=')) {
			root = resolve(argument.slice('--root='.length));
		} else {
			console.error(`Unknown argument: ${argument}. Usage: node tools/check-translations.mjs [--root <folder of the plugin>]`);
			process.exit(2);
		}
	}

	let result;
	try {
		result = checkTranslations({ root });
	} catch (error) {
		console.error(`check-translations: ${error.message}`);
		process.exit(1);
	}

	if (!result.ok) {
		for (const problem of result.problems) console.error(`check-translations: ${problem}`);
		process.exit(1);
	}
	for (const line of result.checked) console.log(`check-translations: ${line}`);
	console.log(`check-translations: WordPress finds the translations of ${result.checked.length} editor script(s) (script x language).`);
}

// Run as a command, not when a test or another tool imports the functions (by file name: a path written another way never skips it).
if (basename(process.argv[1] ?? '') === 'check-translations.mjs') {
	main();
}
