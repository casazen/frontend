/**
 * Development tool, not shipped in the plugin ZIP. Run with `npm run test:tools` (the workflow "WordPress plugin" does not need a
 * browser or WordPress for it).
 *
 * The proof of three rules of the release:
 *
 *   - DATA: a release whose tag is not `wp-plugin-v<version>` of the plugin is refused (tools/check-version.mjs), and so is a plugin
 *     whose version strings differ.
 *   - DATA AND SECURITY: the ZIP has ONE top-level folder `casazen/` and holds no test, tool, `node_modules`, `vendor`, composer or
 *     package file, dotfile, key or other ZIP, however the sources are laid out (tools/build-zip.mjs with the real `.distignore`).
 *   - DATA: the texts of the block editor are found by WordPress. It asks for `languages/<domain>-<locale>-<md5 of the path of the
 *     built script>.json`, and `wp i18n make-json` names each file after the md5 of the path that the catalog cites: so the catalog
 *     must cite `blocks/build/<block>/index.js`, never the sources (`blocks/src`), or the files in the ZIP are never loaded.
 *     tools/check-translations.mjs computes the names the way WordPress does and fails when a built script has no file; it is proved
 *     here on the real catalog and on the old one (the one that cited the sources), with a stand-in of `wp i18n make-json` (WP-CLI
 *     exists only in CI, where the same check runs on the real files, in the step that compiles the translations).
 *   - DATA: a ZIP carries the address of the console of ITS environment (`includes/build-config.php`, written by `build-zip.mjs
 *     --app-origin` into the ZIP only, never into the sources), so the plugin downloaded from the test console connects to test and the
 *     one from production to production: only an `https` origin is accepted, the ZIP is read back, and `publish-release.mjs` refuses a
 *     ZIP whose address is not the one of its channel (the ZIPs here are built for real, the GitHub commands are a stand-in of `gh`).
 *   - PERMISSION: the rolling releases are written by ONE job of the workflow, `publish`, with `contents: write` at job level only, on a
 *     push to develop or main of this repository only, and the commands it builds never force, delete, move or recreate a tag.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import phpParser from 'php-parser';
import { BUILD_CONFIG_PATH, blockNames, buildConfigPhp, buildZip, listZip, parseAppOrigin, parseDistignore, readBuildConfigOrigin, readZipEntry, verifyBuildConfig, verifyEntries, isIgnored } from './build-zip.mjs';
import { builtBlockScripts, checkTranslations, parsePo, readTextDomain, scriptTranslationFileName } from './check-translations.mjs';
import { checkVersions, readVersions, TAG_PREFIX } from './check-version.mjs';
import { ASSET_NAME, CHANNELS, appOriginOf, channelOf, formatCommand, planPublish, probeCommand, publish, releaseExistsFrom, releaseNotes, releaseTag, shellQuote, verifyZipForChannel } from './publish-release.mjs';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const PLUGIN = resolve(TOOLS, '..');
const scratch = mkdtempSync(join(tmpdir(), 'casazen-tools-test-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

/** Writes `files` (path => content) below `root`. */
function writeTree(root, files) {
	for (const [path, content] of Object.entries(files)) {
		const target = join(root, ...path.split('/'));
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, content);
	}
}

/** The files of a plugin folder at `version`: everything that goes into the ZIP, and everything that must stay out of it. */
function pluginFiles(version) {
	const main = `<?php\n/**\n * Plugin Name: CasaZen\n * Version:           ${version}\n * Text Domain:       casazen\n */\n\ndefine( 'CASAZEN_VERSION', '${version}' );\n`;
	return {
		'casazen.php': main,
		'uninstall.php': '<?php\n',
		'readme.txt': `=== CasaZen ===\nStable tag: ${version}\n`,
		'license.txt': 'GPL',
		'includes/class-plugin.php': '<?php\n',
		'blocks/src/booking/block.json': '{}',
		'blocks/src/booking/index.js': 'export {}',
		'blocks/build/booking/block.json': JSON.stringify({ name: 'casazen/booking', textdomain: 'casazen', editorScript: 'file:./index.js' }),
		'blocks/build/booking/index.js': 'x',
		'languages/casazen.pot': '#',
		'languages/casazen-it_IT.po': '#',
		'languages/casazen-it_IT.mo': 'mo',
		// The file that WordPress asks for to translate the editor script of the block (the md5 of blocks/build/booking/index.js).
		[`languages/${scriptTranslationFileName('casazen', 'it_IT', 'blocks/build/booking/index.js')}`]: '{}',
		// None of these goes into the ZIP.
		'tests/phpunit/test-settings.php': '<?php\n',
		'tests/smoke/smoke.sh': '#!/bin/sh\n',
		'tools/build-zip.mjs': '//',
		'node_modules/left-pad/index.js': '//',
		'vendor/autoload.php': '<?php\n',
		'composer.json': '{}',
		'composer.lock': '{}',
		'package.json': '{}',
		'package-lock.json': '{}',
		'phpcs.xml.dist': '<ruleset/>',
		'phpunit.xml.dist': '<phpunit/>',
		'README.md': '# CasaZen',
		'.wp-env.json': '{}',
		'.gitignore': 'dist',
		'.env': 'SECRET=1',
		'dist/casazen-0.0.1.zip': 'zip',
		'old.zip': 'zip',
		'debug.log': 'log',
	};
}

/** A fresh plugin folder in the scratch folder, with the REAL `.distignore` of the plugin. */
function makePlugin(name, version) {
	const root = join(scratch, name);
	writeTree(root, { ...pluginFiles(version), '.distignore': readFileSync(join(PLUGIN, '.distignore'), 'utf8') });
	return root;
}

describe('check-version', () => {
	const { version } = checkVersions();

	it('knows the version of the plugin: the header, the constant and the Stable tag are one string', () => {
		assert.ok(version, 'the plugin must have one version');
		assert.equal(new Set(readVersions().map((entry) => entry.value)).size, 1);
	});

	it('accepts the tag of the plugin version', () => {
		assert.deepEqual(checkVersions({ tag: `${TAG_PREFIX}${version}` }).problems, []);
	});

	it('refuses a tag that is not the version of the plugin (the command exits 1 and says why)', () => {
		const wrong = spawnSync(process.execPath, [join(TOOLS, 'check-version.mjs'), '--tag', `${TAG_PREFIX}99.99.99`], { encoding: 'utf8' });
		assert.equal(wrong.status, 1);
		assert.match(wrong.stderr, new RegExp(`does not match the version of the plugin: its version is ${version.replaceAll('.', '\\.')}`));

		const right = spawnSync(process.execPath, [join(TOOLS, 'check-version.mjs'), '--tag', `${TAG_PREFIX}${version}`], { encoding: 'utf8' });
		assert.equal(right.status, 0, right.stderr);
	});

	it('refuses a tag without the prefix of the plugin tags', () => {
		const result = checkVersions({ tag: `v${version}` });
		assert.equal(result.ok, false);
		assert.match(result.problems.join('\n'), /does not start with wp-plugin-v/);
	});

	it('refuses a plugin whose version strings differ', () => {
		const root = join(scratch, 'differs');
		writeTree(root, { ...pluginFiles('0.2.0'), 'readme.txt': '=== CasaZen ===\nStable tag: 0.1.0\n' });
		const result = checkVersions({ root });
		assert.equal(result.ok, false);
		assert.match(result.problems.join('\n'), /not the same everywhere/);
	});

	it('refuses a text that is not a version', () => {
		const root = join(scratch, 'not-a-version');
		writeTree(root, pluginFiles('latest'));
		assert.equal(checkVersions({ root }).ok, false);
	});
});

describe('build-zip', () => {
	it('puts the plugin in ONE top-level folder and leaves out every development file', async () => {
		const root = makePlugin('good', '1.2.3');
		const outDir = join(scratch, 'good-out');
		const { zipPath, version, entries } = await buildZip({ root, outDir });

		assert.equal(version, '1.2.3');
		assert.equal(zipPath, join(outDir, 'casazen-1.2.3.zip'));

		const names = listZip(zipPath).map((entry) => entry.name);
		assert.deepEqual(names, entries.map((entry) => entry.name));
		assert.ok(names.every((name) => name === 'casazen/' || name.startsWith('casazen/')), 'every entry is inside casazen/');

		const wanted = [
			'casazen/casazen.php',
			'casazen/uninstall.php',
			'casazen/readme.txt',
			'casazen/license.txt',
			'casazen/includes/class-plugin.php',
			'casazen/blocks/build/booking/block.json',
			'casazen/blocks/build/booking/index.js',
			'casazen/languages/casazen-it_IT.mo',
			`casazen/languages/${scriptTranslationFileName('casazen', 'it_IT', 'blocks/build/booking/index.js')}`,
		];
		for (const name of wanted) assert.ok(names.includes(name), `${name} must be in the ZIP`);

		const forbidden = [
			'tests',
			'tools',
			'node_modules',
			'vendor',
			'blocks/src',
			'composer.json',
			'composer.lock',
			'package.json',
			'package-lock.json',
			'phpcs.xml.dist',
			'phpunit.xml.dist',
			'README.md',
			'.wp-env.json',
			'.gitignore',
			'.env',
			'.distignore',
			'dist',
			'old.zip',
			'debug.log',
		];
		for (const name of forbidden) {
			assert.ok(!names.some((entry) => entry === `casazen/${name}` || entry.startsWith(`casazen/${name}/`)), `${name} must not be in the ZIP`);
		}
	});

	it('gives the same bytes for the same sources', async () => {
		const root = makePlugin('same', '1.2.3');
		const first = await buildZip({ root, outDir: join(scratch, 'same-a') });
		const second = await buildZip({ root, outDir: join(scratch, 'same-b') });
		assert.deepEqual(readFileSync(first.zipPath), readFileSync(second.zipPath));
	});

	it('refuses to build when the version strings differ', async () => {
		const root = join(scratch, 'differs-build');
		writeTree(root, { ...pluginFiles('0.2.0'), 'readme.txt': '=== CasaZen ===\nStable tag: 0.1.0\n', '.distignore': '.*\n' });
		await assert.rejects(buildZip({ root, outDir: join(scratch, 'differs-out') }), /not one string/);
	});

	it('refuses a ZIP without the blocks or without the compiled translations', async () => {
		const files = { ...pluginFiles('1.2.3'), '.distignore': readFileSync(join(PLUGIN, '.distignore'), 'utf8') };
		delete files['blocks/build/booking/index.js'];
		const noBuild = join(scratch, 'no-build');
		writeTree(noBuild, files);
		await assert.rejects(buildZip({ root: noBuild, outDir: join(scratch, 'no-build-out') }), /blocks\/build\/booking\/index\.js/);

		const noTranslations = makePlugin('no-translations', '1.2.3');
		rmSync(join(noTranslations, 'languages', 'casazen-it_IT.mo'));
		await assert.rejects(buildZip({ root: noTranslations, outDir: join(scratch, 'no-translations-out') }), /languages\/\*\.mo/);
		const allowed = await buildZip({ root: noTranslations, outDir: join(scratch, 'no-translations-out'), allowMissingTranslations: true });
		assert.ok(allowed.entries.length > 0);
	});

	it('refuses a ZIP whose editor translations carry the name of the sources, a file that WordPress never asks for', async () => {
		const files = { ...pluginFiles('1.2.3'), '.distignore': readFileSync(join(PLUGIN, '.distignore'), 'utf8') };
		delete files[`languages/${scriptTranslationFileName('casazen', 'it_IT', 'blocks/build/booking/index.js')}`];
		files[`languages/${scriptTranslationFileName('casazen', 'it_IT', 'blocks/src/shared/placeholder-edit.js')}`] = '{}';
		const root = join(scratch, 'source-names');
		writeTree(root, files);
		await assert.rejects(buildZip({ root, outDir: join(scratch, 'source-names-out') }), /casazen-it_IT-1b303d512a6dfa503704c2d02858133d\.json: WordPress asks for it to translate blocks\/build\/booking\/index\.js into it_IT/);
	});

	it('wants, in the ZIP, the file that WordPress asks for, for each script and each language the ZIP ships', () => {
		const script = 'blocks/build/booking/index.js';
		const options = { blocks: ['booking'], scripts: [script] };
		const base = [
			'casazen/',
			'casazen/casazen.php',
			'casazen/uninstall.php',
			'casazen/readme.txt',
			'casazen/license.txt',
			'casazen/includes/class-plugin.php',
			'casazen/blocks/build/booking/block.json',
			'casazen/blocks/build/booking/index.js',
			'casazen/languages/casazen.pot',
			'casazen/languages/casazen-it_IT.po',
			'casazen/languages/casazen-it_IT.mo',
		];
		const entries = (...extra) => [...base, ...extra].map((name) => ({ name }));
		const asked = `casazen/languages/${scriptTranslationFileName('casazen', 'it_IT', script)}`;
		assert.deepEqual(verifyEntries(entries(asked), options), []);

		// The file of the old catalog, named after the source of the texts: in the ZIP, and never loaded.
		const source = `casazen/languages/${scriptTranslationFileName('casazen', 'it_IT', 'blocks/src/shared/placeholder-edit.js')}`;
		const problems = verifyEntries(entries(source), options);
		assert.equal(problems.length, 1);
		assert.match(problems[0], /casazen\/languages\/casazen-it_IT-1b303d512a6dfa503704c2d02858133d\.json/);

		// A second language needs its own file for every script.
		const german = verifyEntries(entries(asked, 'casazen/languages/casazen-de_DE.mo'), options);
		assert.equal(german.length, 1);
		assert.match(german[0], /casazen-de_DE-[0-9a-f]{32}\.json: WordPress asks for it to translate blocks\/build\/booking\/index\.js into de_DE/);

		// Without the names of the scripts nothing is asked of the ZIP (the callers that do not know them keep working).
		assert.deepEqual(verifyEntries(entries(source), { blocks: ['booking'] }), []);
	});

	it('refuses a ZIP that holds a development file, whatever .distignore says', () => {
		const good = ['casazen/', 'casazen/casazen.php', 'casazen/uninstall.php', 'casazen/readme.txt', 'casazen/license.txt', 'casazen/includes/class-plugin.php'];
		const options = { requireTranslations: false };
		assert.deepEqual(verifyEntries(good.map((name) => ({ name })), options), []);

		for (const extra of ['casazen/tests/test-x.php', 'casazen/tools/build-zip.mjs', 'casazen/vendor/autoload.php', 'casazen/node_modules/a/b.js', 'casazen/composer.json', 'casazen/package.json', 'casazen/.env', 'casazen/includes/.DS_Store', 'casazen/keys/site.pem', 'casazen/blocks/src/booking/index.js']) {
			assert.ok(verifyEntries([...good, extra].map((name) => ({ name })), options).length > 0, `${extra} must be refused`);
		}
		assert.ok(verifyEntries([...good, 'other/casazen.php'].map((name) => ({ name })), options).length > 0, 'a second top-level folder must be refused');
	});
});

describe('.distignore', () => {
	const rules = parseDistignore(readFileSync(join(PLUGIN, '.distignore'), 'utf8'));

	it('leaves out what the development needs and keeps what the plugin needs', () => {
		for (const [path, directory] of [['tests', true], ['tools', true], ['blocks/src', true], ['node_modules', true], ['vendor', true], ['dist', true], ['package.json', false], ['package-lock.json', false], ['composer.json', false], ['phpcs.xml.dist', false], ['.wp-env.json', false], ['README.md', false], ['x/y/.hidden', false]]) {
			assert.equal(isIgnored(rules, path, directory), true, `${path} must be left out`);
		}
		// includes/build-config.php is written into the ZIP by --app-origin: no rule may leave it out.
		for (const [path, directory] of [['casazen.php', false], ['uninstall.php', false], ['includes', true], [BUILD_CONFIG_PATH, false], ['blocks/build', true], ['blocks/build/booking/block.json', false], ['languages', true], ['readme.txt', false], ['license.txt', false]]) {
			assert.equal(isIgnored(rules, path, directory), false, `${path} must be kept`);
		}
	});
});

describe('translation catalog', () => {
	const blocks = blockNames(PLUGIN);
	const built = (block) => `blocks/build/${block}/index.js`;

	for (const file of ['casazen.pot', 'casazen-it_IT.po']) {
		it(`${file} cites the built script of every block and no source script`, () => {
			assert.ok(blocks.length > 0, 'the plugin has blocks');
			const scripts = readFileSync(join(PLUGIN, 'languages', file), 'utf8')
				.split(/\r?\n/)
				.filter((line) => line.startsWith('#: '))
				.flatMap((line) => line.slice(3).split(' '))
				.map((reference) => reference.replace(/:\d+$/, ''))
				.filter((reference) => reference.endsWith('.js'));

			const notBuilt = scripts.filter((script) => !blocks.some((block) => script === built(block)));
			assert.deepEqual(notBuilt, [], `${file} cites a script that WordPress never asks the translations of: cite blocks/build/<block>/index.js (the editor texts of the blocks stay in English otherwise)`);
			for (const block of blocks) {
				assert.ok(scripts.includes(built(block)), `${file} must cite ${built(block)}: without it there is no JSON file for the editor of the block "${block}"`);
			}
		});
	}
});

/** The md5 that `wp i18n make-json` puts in the name of a file: computed here, not by the tool that is under test. */
const md5 = (text) => createHash('md5').update(text).digest('hex');

/**
 * A stand-in for `wp i18n make-json languages --no-purge` (WP-CLI is installed only in CI): for every script that the catalog cites
 * (a reference that ends in `.js`, `.min.js` read as `.js`) it writes `languages/<catalog>-<md5 of the cited path>.json`, in the
 * format of Jed, with the translated texts of the entries that cite that script. The names and the shape are those of the real
 * command, which the pull request compared with a run of the real WP-CLI.
 */
function makeJson(root, locale = 'it_IT') {
	const catalog = `casazen-${locale}`;
	const entries = parsePo(readFileSync(join(root, 'languages', `${catalog}.po`), 'utf8'));
	const sources = new Map();
	for (const entry of entries) {
		for (const reference of entry.references) {
			if (!reference.endsWith('.js')) continue;
			const source = reference.endsWith('.min.js') ? `${reference.slice(0, -'.min.js'.length)}.js` : reference;
			if (!sources.has(source)) sources.set(source, new Set());
			sources.get(source).add(entry);
		}
	}
	for (const [source, cited] of sources) {
		const messages = { '': { domain: 'messages', lang: locale, 'plural-forms': 'nplurals=2; plural=(n != 1);' } };
		for (const entry of cited) {
			if (!entry.strings.some((text) => text !== '')) continue;
			messages[entry.context === undefined ? entry.id : `${entry.context}\u0004${entry.id}`] = entry.strings;
		}
		const json = { 'translation-revision-date': '2026-11-20T00:00:00+00:00', generator: 'WP-CLI/2.12.0', source, domain: 'messages', locale_data: { messages } };
		writeFileSync(join(root, 'languages', `${catalog}-${md5(source)}.json`), JSON.stringify(json));
	}
}

/** The catalog of the plugin as it was before the fix: the texts of the editor cite the source of the shared component. */
function citeSources(catalog) {
	return catalog
		.split('\n')
		.map((line) => (line.startsWith('#: ') ? line.replace(/(?:blocks\/build\/[a-z-]+\/index\.js ?)+/, 'blocks/src/shared/placeholder-edit.js:35 ').replace(/ +$/, '') : line))
		.join('\n');
}

/** A folder with what the check reads: casazen.php, the built blocks and the catalog. */
function makeBuiltPlugin(name, { catalog, blocks = ['booking', 'search'] }) {
	const root = join(scratch, name);
	const files = { 'casazen.php': pluginFiles('1.2.3')['casazen.php'], 'languages/casazen-it_IT.po': catalog };
	for (const block of blocks) {
		files[`blocks/build/${block}/block.json`] = JSON.stringify({ name: `casazen/${block}`, textdomain: 'casazen', editorScript: 'file:./index.js' });
		files[`blocks/build/${block}/index.js`] = '/* the built script */';
	}
	writeTree(root, files);
	return root;
}

/** A small catalog whose texts of the editor cite `scripts`; the second one is also in a PHP file; the third has a context. */
function smallCatalog(...scripts) {
	return [
		'msgid ""',
		'msgstr ""',
		'"Language: it_IT\\n"',
		'"Plural-Forms: nplurals=2; plural=(n != 1);\\n"',
		'',
		`#: ${scripts.join(' ')}`,
		'msgid "Language"',
		'msgstr "Lingua"',
		'',
		`#: ${scripts.join(' ')} includes/class-admin.php:459`,
		'msgid "Booking page"',
		'msgstr "Pagina di prenotazione"',
		'',
		'#: blocks/src/booking/block.json',
		'msgctxt "block title"',
		'msgid "CasaZen booking"',
		'msgstr "Prenotazione CasaZen"',
		'',
	].join('\n');
}

describe('script translations: the files that WordPress asks for', () => {
	it('names the file after the md5 of the path of the built script, below the plugin folder and unminified', () => {
		const booking = scriptTranslationFileName('casazen', 'it_IT', 'blocks/build/booking/index.js');
		assert.equal(booking, `casazen-it_IT-${md5('blocks/build/booking/index.js')}.json`);
		// The name that real WordPress (7.1.5, in Playground) asked for when the editor script of the booking block was printed.
		assert.equal(booking, 'casazen-it_IT-1b303d512a6dfa503704c2d02858133d.json');
		// Translations are based on the unminified file: x.min.js is read as x.js, like WordPress and make-json do.
		assert.equal(scriptTranslationFileName('casazen', 'it_IT', 'blocks/build/booking/index.min.js'), booking);
		// The path of the source is another name: the file made for it is never asked for.
		assert.notEqual(scriptTranslationFileName('casazen', 'it_IT', 'blocks/src/shared/placeholder-edit.js'), booking);
	});

	it('registers the translations of every editor script with the text domain and the languages folder of the plugin', () => {
		// WordPress looks for the file in the folder given to wp_set_script_translations(): without it only wp-content/languages/plugins
		// is searched and the JSON files of the ZIP are never read. (Run on real WordPress in Playground: see the pull request.)
		const php = readFileSync(join(PLUGIN, 'includes', 'class-blocks.php'), 'utf8');
		assert.match(php, /foreach \( \$type->editor_script_handles as \$handle \) \{\s*wp_set_script_translations\( \$handle, 'casazen', CASAZEN_DIR \. 'languages' \);/);

		const domain = readTextDomain(PLUGIN);
		assert.equal(domain, 'casazen');
		for (const block of blockNames(PLUGIN)) {
			const metadata = JSON.parse(readFileSync(join(PLUGIN, 'blocks', 'src', block, 'block.json'), 'utf8'));
			assert.equal(metadata.textdomain, domain, `${block}: the text domain of block.json`);
			// `npm run build` writes blocks/build/<block>/index.js: the script that the catalog must cite.
			assert.equal(metadata.editorScript, 'file:./index.js', `${block}: the editor script`);
		}
	});

	it('finds the editor scripts of the built blocks in their block.json', () => {
		const root = join(scratch, 'built-scripts');
		writeTree(root, {
			// A list, a script outside the folder of the block, a handle that is no file; the front-end scripts get no translations.
			'blocks/build/a/block.json': JSON.stringify({ editorScript: ['file:./index.js', 'file:../shared/x.js', 'a-registered-handle'], script: 'file:./front.js', viewScript: 'file:./view.js' }),
			'blocks/build/a/index.js': '',
			'blocks/build/b/block.json': JSON.stringify({ editorScript: 'file:index.js' }),
			'blocks/build/c/other.json': '{}',
			'blocks/build/readme.txt': 'not a block',
		});
		assert.deepEqual(
			builtBlockScripts(root).map(({ block, field, script, exists }) => `${block} ${field} ${script} ${exists}`),
			['a editorScript blocks/build/a/index.js true', 'a editorScript blocks/build/shared/x.js false', 'b editorScript blocks/build/b/index.js false']
		);
		assert.deepEqual(builtBlockScripts(join(scratch, 'never-built')), []);
	});

	it('reads a catalog: contexts, plural forms, continued lines, references without line numbers, no obsolete entry', () => {
		const entries = parsePo(
			[
				'msgid ""',
				'msgstr ""',
				'"Language: it_IT\\n"',
				'',
				'#: blocks/build/a/index.js includes/x.php:12 includes/x.php:40',
				'#, php-format',
				'msgctxt "block title"',
				'msgid "Hello "',
				'"%s \\"you\\""',
				'msgstr "Ciao "',
				'"%s"',
				'',
				'msgid "One"',
				'msgid_plural "Many"',
				'msgstr[0] "Uno"',
				'msgstr[1] "Molti"',
				'',
				'#~ msgid "Gone"',
				'#~ msgstr "Andato"',
			].join('\n')
		);
		assert.deepEqual(entries, [
			{ context: 'block title', id: 'Hello %s "you"', strings: ['Ciao %s'], references: ['blocks/build/a/index.js', 'includes/x.php', 'includes/x.php'] },
			{ context: undefined, id: 'One', strings: ['Uno', 'Molti'], references: [] },
		]);
	});

	describe('the real catalog of the plugin', () => {
		const catalog = readFileSync(join(PLUGIN, 'languages', 'casazen-it_IT.po'), 'utf8');
		const blocks = blockNames(PLUGIN);

		it('gets, from `wp i18n make-json`, the file that WordPress asks for, for every block', () => {
			const root = makeBuiltPlugin('real-catalog', { catalog, blocks });
			makeJson(root);

			const result = checkTranslations({ root });
			assert.deepEqual(result.problems, []);
			assert.equal(result.ok, true);
			assert.equal(result.checked.length, blocks.length);
		});

		it('fails on the catalog of before the fix (it cited the sources): the files exist and WordPress never asks for them', () => {
			const old = citeSources(catalog);
			assert.ok(old.includes('blocks/src/shared/placeholder-edit.js:35'), 'the old catalog cites the source of the shared component');
			assert.ok(!old.includes('blocks/build/'), 'the old catalog cites no built script');

			const root = makeBuiltPlugin('old-catalog', { catalog: old, blocks });
			makeJson(root);

			const result = checkTranslations({ root });
			assert.equal(result.ok, false);
			assert.equal(result.checked.length, 0);
			for (const block of blocks) {
				const file = scriptTranslationFileName('casazen', 'it_IT', `blocks/build/${block}/index.js`);
				assert.ok(result.problems.some((problem) => problem.includes(`${file} is missing`) && problem.includes(`blocks/build/${block}/index.js`)), `the file of the block "${block}" is reported as missing`);
			}
			const joined = result.problems.join('\n');
			assert.match(joined, /cites blocks\/src\/shared\/placeholder-edit\.js/);
			assert.match(joined, new RegExp(`casazen-it_IT-${md5('blocks/src/shared/placeholder-edit.js')}\\.json for it_IT, which no built script of the plugin asks for`));
		});
	});

	describe('the check', () => {
		it('accepts the files that make-json writes for a catalog that cites the built scripts', () => {
			const root = makeBuiltPlugin('check-good', { catalog: smallCatalog('blocks/build/booking/index.js', 'blocks/build/search/index.js') });
			makeJson(root);
			const result = checkTranslations({ root });
			assert.deepEqual(result.problems, []);
			assert.deepEqual(result.checked, [
				`it_IT: blocks/build/booking/index.js is translated by languages/${scriptTranslationFileName('casazen', 'it_IT', 'blocks/build/booking/index.js')}`,
				`it_IT: blocks/build/search/index.js is translated by languages/${scriptTranslationFileName('casazen', 'it_IT', 'blocks/build/search/index.js')}`,
			]);
		});

		it('checks every language of the plugin on its own', () => {
			const catalog = smallCatalog('blocks/build/booking/index.js', 'blocks/build/search/index.js');
			const root = makeBuiltPlugin('check-two-languages', { catalog });
			writeTree(root, { 'languages/casazen-de_DE.po': catalog.replace('Language: it_IT', 'Language: de_DE') });
			makeJson(root, 'it_IT');

			// Italian is complete; German has a catalog and no compiled file.
			const result = checkTranslations({ root });
			assert.equal(result.ok, false);
			assert.equal(result.checked.length, 2);
			assert.ok(result.checked.every((line) => line.startsWith('it_IT: ')));
			assert.equal(result.problems.length, 2);
			assert.ok(result.problems.every((problem) => problem.includes('casazen-de_DE-') && problem.includes('into de_DE')));

			makeJson(root, 'de_DE');
			assert.deepEqual(checkTranslations({ root }).problems, []);
		});

		it('fails when the translations were not compiled at all', () => {
			const root = makeBuiltPlugin('check-not-compiled', { catalog: smallCatalog('blocks/build/booking/index.js', 'blocks/build/search/index.js') });
			const result = checkTranslations({ root });
			assert.equal(result.ok, false);
			assert.equal(result.problems.length, 2);
			assert.match(result.problems[0], /languages\/casazen-it_IT-1b303d512a6dfa503704c2d02858133d\.json is missing: WordPress asks for it to translate blocks\/build\/booking\/index\.js into it_IT; .*does cite it, so "wp i18n make-json/);
		});

		it('fails when a built block has no file because the catalog does not cite its script', () => {
			// The catalog cites the booking script only: the search block would stay in English.
			const root = makeBuiltPlugin('check-one-block', { catalog: smallCatalog('blocks/build/booking/index.js') });
			makeJson(root);
			const result = checkTranslations({ root });
			assert.equal(result.ok, false);
			assert.equal(result.problems.length, 1);
			assert.match(result.problems[0], /casazen-it_IT-9a029d8ce3ce79db8f4bbe050807d0d7\.json is missing: .*blocks\/build\/search\/index\.js into it_IT; .*cites blocks\/build\/booking\/index\.js, and .*the catalog must cite blocks\/build\/search\/index\.js/);
		});

		it('fails when the file does not hold the translated texts of the catalog, or is not what make-json writes', () => {
			const root = makeBuiltPlugin('check-wrong-content', { catalog: smallCatalog('blocks/build/booking/index.js', 'blocks/build/search/index.js') });
			makeJson(root);
			const booking = join(root, 'languages', scriptTranslationFileName('casazen', 'it_IT', 'blocks/build/booking/index.js'));
			const search = join(root, 'languages', scriptTranslationFileName('casazen', 'it_IT', 'blocks/build/search/index.js'));

			const json = JSON.parse(readFileSync(booking, 'utf8'));
			delete json.locale_data.messages['Booking page'];
			writeFileSync(booking, JSON.stringify(json));
			writeFileSync(search, 'this is not JSON');

			const result = checkTranslations({ root });
			assert.equal(result.ok, false);
			assert.match(result.problems.join('\n'), /lacks 1 translated text\(s\) that languages\/casazen-it_IT\.po cites for blocks\/build\/booking\/index\.js, for example "Booking page"/);
			assert.match(result.problems.join('\n'), /casazen-it_IT-9a029d8ce3ce79db8f4bbe050807d0d7\.json is not valid JSON/);

			// The right file name with the texts of another script inside: a file copied from the wrong place.
			writeFileSync(search, JSON.stringify({ source: 'blocks/build/booking/index.js', domain: 'messages', locale_data: { messages: { '': {} } } }));
			assert.match(checkTranslations({ root }).problems.join('\n'), /says it holds the texts of blocks\/build\/booking\/index\.js, but its name is the one of blocks\/build\/search\/index\.js/);
		});

		it('fails when nothing was built, when a block names a script that was not built, and when there is no catalog', () => {
			const none = join(scratch, 'check-nothing');
			writeTree(none, { 'casazen.php': pluginFiles('1.2.3')['casazen.php'] });
			const result = checkTranslations({ root: none });
			assert.equal(result.ok, false);
			assert.match(result.problems.join('\n'), /holds no built block.*run "npm run build" first/);
			assert.match(result.problems.join('\n'), /languages\/ holds no casazen-<locale>\.po catalog/);

			const missingScript = makeBuiltPlugin('check-missing-script', { catalog: smallCatalog('blocks/build/booking/index.js'), blocks: ['booking'] });
			rmSync(join(missingScript, 'blocks', 'build', 'booking', 'index.js'));
			assert.match(checkTranslations({ root: missingScript }).problems.join('\n'), /blocks\/build\/booking\/block\.json names blocks\/build\/booking\/index\.js as its editorScript, but the file was not built/);
		});

		it('runs as a command: exit 1 with the reasons on stderr, exit 0 with a line per script', () => {
			const run = (root) => spawnSync(process.execPath, [join(TOOLS, 'check-translations.mjs'), '--root', root], { encoding: 'utf8' });

			const root = makeBuiltPlugin('check-command', { catalog: smallCatalog('blocks/build/booking/index.js', 'blocks/build/search/index.js') });
			const before = run(root);
			assert.equal(before.status, 1);
			assert.match(before.stderr, /check-translations: languages\/casazen-it_IT-1b303d512a6dfa503704c2d02858133d\.json is missing/);

			makeJson(root);
			const after = run(root);
			assert.equal(after.status, 0, after.stderr);
			assert.match(after.stdout, /it_IT: blocks\/build\/booking\/index\.js is translated by languages\/casazen-it_IT-1b303d512a6dfa503704c2d02858133d\.json/);
			assert.match(after.stdout, /WordPress finds the translations of 2 editor script\(s\)/);
		});
	});
});

describe('build-zip --app-origin: the address of the console, inside the ZIP and nowhere else', () => {
	const ORIGIN = 'https://app.example.org';
	const CONFIG = `casazen/${BUILD_CONFIG_PATH}`;
	const BUILD_ZIP = join(TOOLS, 'build-zip.mjs');

	it('writes includes/build-config.php into the ZIP with that address, and never into the sources', async () => {
		const root = makePlugin('origin-good', '1.2.3');
		const { zipPath, appOrigin, entries } = await buildZip({ root, outDir: join(scratch, 'origin-good-out'), appOrigin: ORIGIN });

		assert.equal(appOrigin, ORIGIN);
		assert.deepEqual(entries.map((entry) => entry.name), listZip(zipPath).map((entry) => entry.name));
		assert.ok(entries.some((entry) => entry.name === CONFIG), `${CONFIG} must be in the ZIP`);

		const text = readZipEntry(zipPath, CONFIG).toString('utf8');
		assert.equal(text, buildConfigPhp(ORIGIN));
		assert.equal(readBuildConfigOrigin(text), ORIGIN);
		// The quoting of the repository's PHP standard (WordPress: single quotes, spaces inside the parentheses), LF, a newline at the end.
		assert.match(text, /^defined\( 'ABSPATH' \) \|\| exit;$/m);
		assert.match(text, /^return array\( 'app_origin' => 'https:\/\/app\.example\.org' \);$/m);
		assert.ok(!text.includes('\r') && text.endsWith(';\n'), 'LF line ends and a final newline');
		assert.deepEqual(verifyBuildConfig(zipPath, ORIGIN), []);

		// The ZIP, never the working tree: the sources are as they were.
		assert.equal(existsSync(join(root, 'includes', 'build-config.php')), false);
	});

	it('has no includes/build-config.php without the flag', async () => {
		const root = makePlugin('origin-none', '1.2.3');
		const { zipPath, appOrigin } = await buildZip({ root, outDir: join(scratch, 'origin-none-out') });

		assert.equal(appOrigin, null);
		assert.ok(!listZip(zipPath).some((entry) => entry.name === CONFIG), `${CONFIG} must not be in the ZIP`);
		assert.equal(readZipEntry(zipPath, CONFIG), null);
		assert.match(verifyBuildConfig(zipPath, ORIGIN).join('\n'), /has no casazen\/includes\/build-config\.php/);
	});

	it('gives the same bytes for the same sources and address, and other bytes for another address', async () => {
		const root = makePlugin('origin-same', '1.2.3');
		const first = await buildZip({ root, outDir: join(scratch, 'origin-same-a'), appOrigin: ORIGIN });
		const second = await buildZip({ root, outDir: join(scratch, 'origin-same-b'), appOrigin: ORIGIN });
		const other = await buildZip({ root, outDir: join(scratch, 'origin-same-c'), appOrigin: 'https://other.example.org' });
		assert.deepEqual(readFileSync(first.zipPath), readFileSync(second.zipPath));
		assert.notDeepEqual(readFileSync(first.zipPath), readFileSync(other.zipPath));
	});

	it('is valid PHP 7.4, and what it returns is the address', () => {
		const folder = join(scratch, 'origin-php');
		writeTree(folder, { 'build-config.php': buildConfigPhp(ORIGIN) });

		// The syntax checker of the plugin (php-parser, read as PHP 7.4), as the lint job runs it on every PHP file.
		const checked = spawnSync(process.execPath, [join(TOOLS, 'check-php-syntax.mjs'), folder], { encoding: 'utf8' });
		assert.equal(checked.status, 0, checked.stderr);

		const Engine = phpParser.Engine ?? phpParser;
		const tree = new Engine({ parser: { version: '7.4', suppressErrors: false, extractDoc: false }, ast: { withPositions: false } }).parseCode(buildConfigPhp(ORIGIN), 'build-config.php');
		assert.deepEqual(tree.children.map((statement) => statement.kind), ['expressionstatement', 'return']);
		const guard = tree.children[0].expression;
		assert.equal(guard.type, '||');
		assert.equal(guard.left.what.name, 'defined');
		assert.equal(guard.left.arguments[0].value, 'ABSPATH');
		assert.equal(guard.right.kind, 'exit');
		const { items } = tree.children[1].expr;
		assert.deepEqual(items.map((item) => [item.key.value, item.value.value]), [['app_origin', ORIGIN]]);
	});

	it('accepts an https origin written in its canonical form, and nothing else', async () => {
		for (const value of [ORIGIN, 'https://app.example.org:8443', 'https://casazen-test-app.vercel.app', 'https://localhost:5173', 'https://a.b-c.d1.example']) {
			assert.equal(parseAppOrigin(value), value);
		}

		const refused = [
			['http://app.example.org', /http address.*only talks to the console over https/],
			['http://localhost', /http address/],
			['https://app.example.org/path', /path, a query or a fragment/],
			['https://app.example.org/', /not written as an origin.*write it as https:\/\/app\.example\.org/],
			['https://app.example.org?x=1', /path, a query or a fragment/],
			['https://app.example.org#top', /path, a query or a fragment/],
			['https://user:secret@app.example.org', /credentials/],
			['https://app.example.org:443', /not written as an origin/],
			['https://APP.example.org', /not written as an origin/],
			['HTTPS://app.example.org', /not written as an origin/],
			[' https://app.example.org', /not written as an origin/],
			['https://127.0.0.1', /IP address/],
			['https://[::1]', /IP address/],
			['https://app_x.example.org', /plain host name|not a URL/],
			["https://a'b.example.org", /plain host name/],
			['ftp://app.example.org', /not an https address/],
			['app.example.org', /not a URL/],
			['not a url', /not a URL/],
			['', /empty/],
			['   ', /empty/],
			[undefined, /empty/],
			[null, /empty/],
		];
		for (const [value, message] of refused) {
			assert.throws(() => parseAppOrigin(value), message, `${JSON.stringify(value)} must be refused`);
		}

		// The build refuses the same values before it writes anything.
		const root = makePlugin('origin-refused', '1.2.3');
		for (const value of ['http://app.example.org', 'https://app.example.org/path', 'not a url']) {
			const outDir = join(scratch, 'origin-refused-out');
			await assert.rejects(buildZip({ root, outDir, appOrigin: value }), /--app-origin/);
			assert.equal(existsSync(join(outDir, 'casazen-1.2.3.zip')), false);
		}
	});

	it('as a command: a wrong address is exit 2 with the reason, before anything is built', () => {
		const outDir = join(scratch, 'origin-command-out');
		for (const [args, message] of [
			[['--app-origin', 'http://app.example.org'], /http address.*https/],
			[['--app-origin=https://app.example.org/app'], /path, a query or a fragment/],
			[['--app-origin'], /empty/],
		]) {
			const result = spawnSync(process.execPath, [BUILD_ZIP, '--out', outDir, ...args], { encoding: 'utf8' });
			assert.equal(result.status, 2, `${args.join(' ')}: ${result.stderr}`);
			assert.match(result.stderr, message);
			assert.equal(result.stdout, '');
		}
		assert.equal(existsSync(outDir), false, 'nothing is built for a wrong address');
	});

	it('refuses a plugin folder that already holds includes/build-config.php: the file is generated, never a source', async () => {
		const root = makePlugin('origin-stray', '1.2.3');
		writeTree(root, { 'includes/build-config.php': "<?php\nreturn array( 'app_origin' => 'https://stray.example.org' );\n" });
		for (const appOrigin of [null, ORIGIN]) {
			await assert.rejects(buildZip({ root, outDir: join(scratch, 'origin-stray-out'), appOrigin }), /includes\/build-config\.php is in the plugin folder/);
		}
	});

	it('reads the ZIP back: the file is wanted when an address was given and refused when none was', async () => {
		const base = ['casazen/', 'casazen/casazen.php', 'casazen/uninstall.php', 'casazen/readme.txt', 'casazen/license.txt', 'casazen/includes/class-plugin.php'].map((name) => ({ name }));
		const withConfig = [...base, { name: CONFIG }];
		const options = { requireTranslations: false };

		assert.deepEqual(verifyEntries(base, options), []);
		assert.deepEqual(verifyEntries(withConfig, { ...options, appOrigin: ORIGIN }), []);
		assert.match(verifyEntries(base, { ...options, appOrigin: ORIGIN }).join('\n'), /has no casazen\/includes\/build-config\.php, which must hold the address of the console, https:\/\/app\.example\.org/);
		assert.match(verifyEntries(withConfig, options).join('\n'), /has casazen\/includes\/build-config\.php but no --app-origin was given/);

		// What the ZIP holds is compared with what the generator writes: another address, or another content, is a problem.
		const { zipPath } = await buildZip({ root: makePlugin('origin-readback', '1.2.3'), outDir: join(scratch, 'origin-readback-out'), appOrigin: ORIGIN });
		assert.deepEqual(verifyBuildConfig(zipPath, ORIGIN), []);
		assert.match(verifyBuildConfig(zipPath, 'https://other.example.org').join('\n'), /does not hold the address https:\/\/other\.example\.org: it holds https:\/\/app\.example\.org/);
		assert.equal(readBuildConfigOrigin("<?php\nreturn array( 'app_origin' => 'https://x.example.org', 'other' => 1 );\n"), null);
	});
});

/** The ZIP of a synthetic plugin, built for real, with the address of a console (or none). */
let zipCount = 0;
async function makeZip(appOrigin) {
	zipCount += 1;
	const root = makePlugin(`publish-plugin-${zipCount}`, '1.2.3');
	const { zipPath } = await buildZip({ root, outDir: join(scratch, `publish-zip-${zipCount}`), appOrigin });
	return zipPath;
}

const SHA = '0123456789abcdef0123456789abcdef01234567';
const NOW = new Date('2026-11-27T09:12:34Z');
const ASSET = '/work/dist/casazen.zip';
const PUBLISH = join(TOOLS, 'publish-release.mjs');

/** Every plan of the two channels, for a release that does not exist and for one that does. */
const allPlans = () =>
	Object.keys(CHANNELS).flatMap((channel) =>
		[false, true].map((releaseExists) => ({ channel, releaseExists, plan: planPublish({ channel, sha: SHA, version: '1.2.3', assetPath: ASSET, releaseExists, now: NOW }) }))
	);

/** The words of a command without the text of the notes (which is prose, not a flag). */
const flagsOf = (command) => command.filter((_, index) => command[index - 1] !== '--notes');

/** A stand-in of `gh`: it answers the question about the release, records every command and checks the file that is uploaded. */
function fakeGh({ releaseExists = true, probe, failOn } = {}) {
	const calls = [];
	const uploads = [];
	const run = (command) => {
		calls.push(command);
		if (command[2] === 'view') return probe ?? (releaseExists ? { status: 0, stdout: '{"tagName":"x"}' } : { status: 1, stderr: 'release not found' });
		if (command[2] === 'upload') uploads.push({ name: basename(command[4]), bytes: readFileSync(command[4]) });
		if (command[2] === failOn) return { status: 1, stderr: 'HTTP 422: something went wrong' };
		return { status: 0, stdout: `https://github.com/casazen/frontend/releases/tag/${command[3]}` };
	};
	return { run, calls, uploads };
}

describe('publish-release: the two channels of the rolling release', () => {
	it('knows two channels: develop (the test console, a pre-release) and main (the production console, never "latest")', () => {
		assert.deepEqual(Object.keys(CHANNELS), ['develop', 'main']);
		assert.equal(appOriginOf('develop'), 'https://casazen-test-app.vercel.app');
		assert.equal(appOriginOf('main'), 'https://www.casazen.space');
		assert.equal(CHANNELS.develop.prerelease, true);
		assert.equal(CHANNELS.main.prerelease, false);
		assert.equal(ASSET_NAME, 'casazen.zip');
		for (const [channel, { appOrigin }] of Object.entries(CHANNELS)) {
			assert.equal(parseAppOrigin(appOrigin), appOrigin, `${channel}: the address is a valid --app-origin`);
			assert.equal(releaseTag(channel), `wp-plugin-${channel}`);
			// A tag that started with wp-plugin-v would start the release workflow of the versions.
			assert.ok(!releaseTag(channel).startsWith(TAG_PREFIX), `${releaseTag(channel)} must not look like a versioned release`);
		}
	});

	it('refuses a channel that is not one of the two', () => {
		for (const name of ['staging', '', 'Develop', 'main ', 'v1.0.0', 'wp-plugin-main', '__proto__', 'constructor', 'toString', undefined, null, 42]) {
			assert.throws(() => channelOf(name), /Unknown channel/, String(name));
			assert.throws(() => releaseTag(name), /Unknown channel/, String(name));
			assert.throws(() => appOriginOf(name), /Unknown channel/, String(name));
			assert.throws(() => planPublish({ channel: name, sha: SHA, version: '1.2.3', assetPath: ASSET, releaseExists: false }), /Unknown channel/, String(name));
			assert.throws(() => publish({ channel: name, zip: 'x.zip', sha: SHA, version: '1.2.3', dryRun: true, log: () => {} }), /Unknown channel/, String(name));
		}
		// As a command: exit 2 and nothing else happens.
		const result = spawnSync(process.execPath, [PUBLISH, '--channel', 'staging', '--zip', 'x.zip', '--sha', SHA, '--version', '1.2.3', '--dry-run'], { encoding: 'utf8' });
		assert.equal(result.status, 2);
		assert.match(result.stderr, /Unknown channel "staging"/);
		assert.equal(result.stdout, '');
	});

	it('refuses a commit that is not a full commit and a version that is not a version', () => {
		for (const sha of ['', 'abc123', SHA.toUpperCase(), `${SHA}0`, 'main', undefined]) {
			assert.throws(() => planPublish({ channel: 'develop', sha, version: '1.2.3', assetPath: ASSET, releaseExists: false }), /--sha must be a full commit/);
		}
		for (const version of ['', '1.2', 'v1.2.3', 'latest', '1.2.3 ', undefined]) {
			assert.throws(() => planPublish({ channel: 'develop', sha: SHA, version, assetPath: ASSET, releaseExists: false }), /--version must be a version/);
		}
	});

	it('the command line of the address of a channel prints that address and nothing else', () => {
		for (const [channel, { appOrigin }] of Object.entries(CHANNELS)) {
			const result = spawnSync(process.execPath, [PUBLISH, '--channel', channel, '--print-app-origin'], { encoding: 'utf8' });
			assert.equal(result.status, 0, result.stderr);
			assert.equal(result.stdout, `${appOrigin}\n`);
		}
		assert.equal(spawnSync(process.execPath, [PUBLISH, '--channel', 'staging', '--print-app-origin'], { encoding: 'utf8' }).status, 2);
	});

	it('develop: creates a pre-release once (titled for the channel, the tag at the commit), uploads casazen.zip, and on an existing release uploads and rewrites the notes', () => {
		const notes = releaseNotes({ channel: 'develop', sha: SHA, version: '1.2.3', now: NOW });
		assert.match(notes, new RegExp(SHA));
		assert.match(notes, /Plugin version: 1\.2\.3/);
		assert.match(notes, /Published: 2026-11-27 09:12 UTC/);
		assert.match(notes, /https:\/\/casazen-test-app\.vercel\.app/);

		const created = planPublish({ channel: 'develop', sha: SHA, version: '1.2.3', assetPath: ASSET, releaseExists: false, now: NOW });
		assert.deepEqual(created, [
			['gh', 'release', 'create', 'wp-plugin-develop', '--target', SHA, '--prerelease', '--title', 'CasaZen WordPress plugin (develop)', '--notes', notes],
			['gh', 'release', 'upload', 'wp-plugin-develop', ASSET, '--clobber'],
		]);

		const updated = planPublish({ channel: 'develop', sha: SHA, version: '1.2.3', assetPath: ASSET, releaseExists: true, now: NOW });
		assert.deepEqual(updated, [
			['gh', 'release', 'upload', 'wp-plugin-develop', ASSET, '--clobber'],
			['gh', 'release', 'edit', 'wp-plugin-develop', '--notes', notes, '--prerelease'],
		]);
		assert.deepEqual(probeCommand('develop'), ['gh', 'release', 'view', 'wp-plugin-develop', '--json', 'tagName']);
	});

	it('main: the same, with --latest=false (never the latest release) and no pre-release flag', () => {
		const notes = releaseNotes({ channel: 'main', sha: SHA, version: '1.2.3', now: NOW });
		assert.match(notes, /https:\/\/www\.casazen\.space/);

		const created = planPublish({ channel: 'main', sha: SHA, version: '1.2.3', assetPath: ASSET, releaseExists: false, now: NOW });
		assert.deepEqual(created, [
			['gh', 'release', 'create', 'wp-plugin-main', '--target', SHA, '--latest=false', '--title', 'CasaZen WordPress plugin (main)', '--notes', notes],
			['gh', 'release', 'upload', 'wp-plugin-main', ASSET, '--clobber'],
		]);
		const updated = planPublish({ channel: 'main', sha: SHA, version: '1.2.3', assetPath: ASSET, releaseExists: true, now: NOW });
		assert.deepEqual(updated, [
			['gh', 'release', 'upload', 'wp-plugin-main', ASSET, '--clobber'],
			['gh', 'release', 'edit', 'wp-plugin-main', '--notes', notes, '--latest=false'],
		]);
		for (const { channel, plan } of allPlans()) {
			const flags = plan.flatMap(flagsOf);
			assert.equal(flags.includes('--prerelease'), channel === 'develop', `${channel}: --prerelease`);
			assert.equal(flags.includes('--latest=false'), channel === 'main', `${channel}: --latest=false`);
		}
	});

	it('never forces anything and never deletes, moves or recreates a tag', () => {
		for (const { channel, releaseExists, plan } of allPlans()) {
			const label = `${channel}, release ${releaseExists ? 'exists' : 'does not exist'}`;
			for (const command of [probeCommand(channel), ...plan]) {
				assert.deepEqual(command.slice(0, 2), ['gh', 'release'], label);
				assert.ok(['view', 'create', 'upload', 'edit'].includes(command[2]), `${label}: gh release ${command[2]}`);
				for (const word of flagsOf(command)) {
					assert.ok(!/^(?:--force|-f|--cleanup-tag|--discard-tag|--tag|--verify-tag|--draft|-d)$/.test(word), `${label}: ${word}`);
					assert.ok(!/delete|remove|^rm$/i.test(word), `${label}: ${word}`);
				}
			}
			// The tag is made by the creation, at the commit, and only there: the upload and the edit never name a target or a tag.
			for (const command of plan) {
				assert.equal(command.includes('--target'), command[2] === 'create', `${label}: --target only on create`);
			}
			// The release is created only when it does not exist.
			assert.equal(plan.some((command) => command[2] === 'create'), !releaseExists, label);
		}
	});

	it('uploads a file that is called casazen.zip (the asset takes the name of the file, #label is only a display label)', () => {
		for (const { plan } of allPlans()) {
			const upload = plan.find((command) => command[2] === 'upload');
			assert.equal(basename(upload[4]), 'casazen.zip');
			assert.ok(!upload[4].includes('#'), 'no display label in place of the name');
			assert.deepEqual(upload.slice(5), ['--clobber']);
		}
		assert.throws(() => planPublish({ channel: 'develop', sha: SHA, version: '1.2.3', assetPath: '/work/dist/casazen-1.2.3.zip', releaseExists: true }), /must be called casazen\.zip/);
	});

	it('decides between creating and updating from the answer of `gh release view`', () => {
		assert.equal(releaseExistsFrom({ status: 0, stdout: '{"tagName":"wp-plugin-develop"}' }), true);
		assert.equal(releaseExistsFrom({ status: 1, stderr: 'release not found' }), false);
		// A question that failed is not a "no": nothing is created on a guess.
		assert.throws(() => releaseExistsFrom({ status: 1, stderr: 'HTTP 401: Bad credentials' }), /nothing was created or changed.*Bad credentials/);
		assert.throws(() => releaseExistsFrom({ status: 4, stderr: '' }), /nothing was created or changed/);
		assert.throws(() => releaseExistsFrom({ status: null, error: new Error('spawn gh ENOENT') }), /could not run gh: spawn gh ENOENT/);
	});

	it('quotes a command so that what is printed can be pasted', () => {
		assert.equal(shellQuote('--latest=false'), '--latest=false');
		assert.equal(shellQuote('CasaZen WordPress plugin (develop)'), "'CasaZen WordPress plugin (develop)'");
		assert.equal(shellQuote("it's"), "'it'\\''s'");
		assert.equal(formatCommand(['gh', 'release', 'upload', 'wp-plugin-main', '/a b/casazen.zip', '--clobber']), "gh release upload wp-plugin-main '/a b/casazen.zip' --clobber");
	});
});

describe('publish-release: --dry-run prints the commands and runs none', () => {
	/** An environment with no `gh` anywhere on the PATH: a command that tried to run it would fail. */
	function envWithoutGh() {
		const empty = join(scratch, 'empty-path');
		mkdirSync(empty, { recursive: true });
		return { PATH: empty, SystemRoot: process.env.SystemRoot, windir: process.env.windir };
	}

	for (const channel of Object.keys(CHANNELS)) {
		it(`${channel}: the create-or-update commands, the release name, the flags and the asset casazen.zip`, () => {
			const zip = join(scratch, 'dry-run', `casazen-1.2.3-${channel}.zip`);
			const result = spawnSync(process.execPath, [PUBLISH, '--channel', channel, '--zip', zip, '--sha', SHA, '--version', '1.2.3', '--dry-run'], { encoding: 'utf8', env: envWithoutGh() });
			assert.equal(result.status, 0, result.stderr);
			assert.equal(existsSync(dirname(zip)), false, 'a dry run touches no file');

			// The commands are the lines that start with `gh` (the text of the notes spans lines inside quotes).
			const commands = result.stdout.split('\n').filter((line) => line.startsWith('gh '));
			assert.equal(commands.length, 5, result.stdout);
			assert.match(commands[0], new RegExp(`^gh release view wp-plugin-${channel} --json tagName$`));
			assert.match(commands[1], new RegExp(`^gh release create wp-plugin-${channel} --target ${SHA} ${channel === 'develop' ? '--prerelease' : '--latest=false'} --title 'CasaZen WordPress plugin \\(${channel}\\)' --notes '`));
			assert.match(commands[2], new RegExp(`^gh release upload wp-plugin-${channel} '?[^']*/casazen\\.zip'? --clobber$`));
			assert.equal(commands[3], commands[2]);
			assert.match(commands[4], new RegExp(`^gh release edit wp-plugin-${channel} --notes '`));
			assert.ok(result.stdout.includes('Plugin version: 1.2.3'));

			// Nothing that forces, deletes or moves a tag, in the commands or anywhere in what is printed.
			assert.ok(!/--force|--cleanup-tag|--discard-tag|--tag\b|\bdelete|git tag|git push/i.test(result.stdout), result.stdout);
			assert.equal(result.stdout.includes('--latest=false'), channel === 'main');
			assert.equal(result.stdout.includes('--prerelease'), channel === 'develop');
		});
	}

	it('runs no command and contacts nothing, with or without the ZIP', () => {
		const lines = [];
		const never = () => {
			throw new Error('a dry run must not run a command');
		};
		const result = publish({ channel: 'main', zip: join(scratch, 'no-such-folder', 'casazen-1.2.3.zip'), sha: SHA, version: '1.2.3', dryRun: true, now: NOW, run: never, log: (line) => lines.push(line) });
		assert.equal(result.dryRun, true);
		assert.deepEqual(result.commands.probe, probeCommand('main'));
		assert.deepEqual(result.commands.create.map((command) => command[2]), ['create', 'upload']);
		assert.deepEqual(result.commands.update.map((command) => command[2]), ['upload', 'edit']);
		assert.equal(existsSync(join(scratch, 'no-such-folder')), false);
		assert.ok(lines.some((line) => line.startsWith('gh release create wp-plugin-main ')));
	});
});

describe('publish-release: the real run, with a stand-in of gh', () => {
	const quiet = () => {};

	it('creates the release once when it does not exist, then uploads the ZIP as casazen.zip', async () => {
		const zip = await makeZip(CHANNELS.develop.appOrigin);
		const gh = fakeGh({ releaseExists: false });
		const lines = [];
		const result = publish({ channel: 'develop', zip, sha: SHA, version: '1.2.3', run: gh.run, now: NOW, repository: 'casazen/frontend', log: (line) => lines.push(line) });

		assert.deepEqual(gh.calls.map((command) => command[2]), ['view', 'create', 'upload']);
		assert.equal(result.created, true);
		// The log says where the ZIP is, at the address that the console links.
		assert.ok(lines.includes('publish-release: https://github.com/casazen/frontend/releases/download/wp-plugin-develop/casazen.zip'), lines.join('\n'));
		// What was uploaded is the ZIP that was built, under the name casazen.zip, and the copy is gone afterwards.
		assert.deepEqual(gh.uploads.map((upload) => upload.name), ['casazen.zip']);
		assert.deepEqual(gh.uploads[0].bytes, readFileSync(zip));
		assert.equal(existsSync(join(dirname(zip), 'casazen.zip')), false);
	});

	it('replaces the asset and the notes of a release that exists, and does not create it again', async () => {
		const zip = await makeZip(CHANNELS.main.appOrigin);
		const gh = fakeGh({ releaseExists: true });
		const result = publish({ channel: 'main', zip, sha: SHA, version: '1.2.3', run: gh.run, now: NOW, log: quiet });

		assert.deepEqual(gh.calls.map((command) => command[2]), ['view', 'upload', 'edit']);
		assert.equal(result.created, false);
		assert.ok(gh.calls.every((command) => command[3] === 'wp-plugin-main'));
		assert.deepEqual(gh.calls.find((command) => command[2] === 'edit').slice(-1), ['--latest=false']);
	});

	it('uploads a ZIP that is already called casazen.zip as it is, and does not remove it afterwards', async () => {
		const built = await makeZip(CHANNELS.develop.appOrigin);
		const zip = join(scratch, 'already-named', 'casazen.zip');
		mkdirSync(dirname(zip), { recursive: true });
		writeFileSync(zip, readFileSync(built));
		const gh = fakeGh({ releaseExists: true });
		publish({ channel: 'develop', zip, sha: SHA, version: '1.2.3', run: gh.run, now: NOW, log: quiet });

		assert.deepEqual(gh.uploads.map((upload) => upload.name), ['casazen.zip']);
		assert.equal(resolve(gh.calls.find((command) => command[2] === 'upload')[4]), zip);
		assert.equal(existsSync(zip), true, 'the file that was given is not removed');
	});

	it('creates nothing when the question about the release fails, and says why', async () => {
		const zip = await makeZip(CHANNELS.develop.appOrigin);
		const gh = fakeGh({ probe: { status: 1, stderr: 'HTTP 401: Bad credentials' } });
		assert.throws(() => publish({ channel: 'develop', zip, sha: SHA, version: '1.2.3', run: gh.run, log: quiet }), /nothing was created or changed.*Bad credentials/);
		assert.equal(gh.calls.length, 1, 'only the question was asked');
	});

	it('fails with the command that failed, and leaves no copy of the ZIP behind', async () => {
		const zip = await makeZip(CHANNELS.develop.appOrigin);
		const gh = fakeGh({ releaseExists: true, failOn: 'upload' });
		assert.throws(() => publish({ channel: 'develop', zip, sha: SHA, version: '1.2.3', run: gh.run, log: quiet }), /gh release upload wp-plugin-develop failed \(exit 1: HTTP 422/);
		assert.deepEqual(gh.calls.map((command) => command[2]), ['view', 'upload'], 'the notes are not rewritten for an asset that was not uploaded');
		assert.equal(existsSync(join(dirname(zip), 'casazen.zip')), false);
	});

	it('refuses a ZIP that is not the ZIP of the channel before it writes anything to GitHub: a test ZIP never goes out as production, nor the other way round', async () => {
		const forMain = await makeZip(CHANNELS.main.appOrigin);
		const forDevelop = await makeZip(CHANNELS.develop.appOrigin);
		const withoutAddress = await makeZip(null);

		for (const [channel, zip, message] of [
			['develop', forMain, /is built for https:\/\/www\.casazen\.space but the channel develop publishes the one of https:\/\/casazen-test-app\.vercel\.app/],
			['main', forDevelop, /is built for https:\/\/casazen-test-app\.vercel\.app but the channel main publishes the one of https:\/\/www\.casazen\.space/],
			['develop', withoutAddress, /has no casazen\/includes\/build-config\.php: it carries no address of the console/],
			['main', join(scratch, 'no-such.zip'), /does not exist/],
		]) {
			const gh = fakeGh();
			assert.throws(() => publish({ channel, zip, sha: SHA, version: '1.2.3', run: gh.run, log: quiet }), message);
			assert.equal(gh.calls.length, 0, 'not even the question about the release is asked');
		}

		assert.deepEqual(verifyZipForChannel(forDevelop, 'develop'), []);
		assert.deepEqual(verifyZipForChannel(forMain, 'main'), []);
		writeTree(scratch, { 'not-a-zip.zip': 'this is not a ZIP' });
		assert.match(verifyZipForChannel(join(scratch, 'not-a-zip.zip'), 'main').join('\n'), /cannot be read as a ZIP/);
	});
});

// The workflow files are read as text (no YAML library is a dependency of the tools): comments are dropped and the jobs are cut by their
// indentation. They are in the repository of the application; when the plugin is split out they are not, and these checks do not run.
const REPOSITORY = resolve(PLUGIN, '..', '..', '..');
const WORKFLOWS = join(REPOSITORY, '.github', 'workflows');
const hasPipeline = existsSync(join(WORKFLOWS, 'wordpress-plugin.yml'));

/** The lines of a workflow without comments and blank lines. */
const codeLines = (text) =>
	text
		.split(/\r?\n/)
		.map((line) => line.replace(/(^|\s)#.*$/, '').trimEnd())
		.filter((line) => line.trim() !== '');

/** The jobs of a workflow: each id with its lines. */
function jobsOf(text) {
	const jobs = new Map();
	let inJobs = false;
	let current = null;
	for (const line of codeLines(text)) {
		if (/^\S/.test(line)) {
			inJobs = /^jobs:$/.test(line);
			current = null;
		} else if (inJobs) {
			const id = /^ {2}([A-Za-z0-9_-]+):$/.exec(line);
			if (id) {
				current = id[1];
				jobs.set(current, []);
			} else if (current !== null) {
				jobs.get(current).push(line);
			}
		}
	}
	return jobs;
}

/** The indented lines of a top-level key of a workflow (`permissions:` and what is under it). */
function topLevelBlock(text, key) {
	const lines = codeLines(text);
	const start = lines.findIndex((line) => line === `${key}:`);
	if (start < 0) return null;
	const block = [];
	for (const line of lines.slice(start + 1)) {
		if (!/^\s/.test(line)) break;
		block.push(line);
	}
	return block;
}

describe('the workflow that publishes the ZIP: who may write, and when', { skip: !hasPipeline && 'the plugin is not inside the repository of the application' }, () => {
	const pipeline = hasPipeline ? readFileSync(join(WORKFLOWS, 'wordpress-plugin.yml'), 'utf8') : '';
	const jobs = jobsOf(pipeline);
	const publishJob = (jobs.get('publish') ?? []).join('\n');

	it('writes with `contents: write` in the job publish at job level, and nowhere else of the workflow', () => {
		assert.deepEqual(topLevelBlock(pipeline, 'permissions'), ['  contents: read'], 'the workflow reads only');
		assert.deepEqual([...jobs].filter(([, lines]) => lines.some((line) => /^ {4}permissions:/.test(line))).map(([id]) => id), ['publish'], 'only the job publish sets permissions');
		assert.match(publishJob, /^ {4}permissions:\n {6}contents: write$/m, 'at job level, and nothing but contents');
		assert.equal(codeLines(pipeline).filter((line) => /contents:\s*write/.test(line)).length, 1, 'one single `contents: write`');
		assert.ok(!/write-all|id-token|pull_request_target|secrets\./.test(pipeline));
	});

	it('runs only on a push to develop or main of this repository, after the job that builds and checks the package', () => {
		assert.match(publishJob, /^ {4}needs: \[package\]$/m);
		assert.deepEqual(jobs.get('package').filter((line) => /^ {4}needs:/.test(line)), ['    needs: [lint, phpunit, smoke]']);
		const condition = /^ {4}if: (.+)$/m.exec(publishJob)?.[1];
		assert.equal(condition, "github.event_name == 'push' && github.repository == 'casazen/frontend' && (github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/main')");
		assert.ok(!/pull_request|workflow_dispatch|schedule/.test(condition), 'never on a pull request or a manual run');
		// The other jobs are untouched: none of them publishes.
		for (const [id, lines] of jobs) {
			if (id !== 'publish') assert.ok(!lines.join('\n').includes('publish-release'), `${id} must not publish`);
		}
	});

	it('gives the token to the last step only, and the checkout does not keep it on disk', () => {
		assert.match(publishJob, /uses: actions\/checkout@v4\n\s+with:\n\s+persist-credentials: false/);
		const tokenLines = codeLines(pipeline).filter((line) => /GH_TOKEN|github\.token/.test(line));
		assert.deepEqual(tokenLines.map((line) => line.trim()), ['GH_TOKEN: ${{ github.token }}']);
		const lastStep = publishJob.slice(publishJob.lastIndexOf('- name:'));
		assert.match(lastStep, /GH_TOKEN: \$\{\{ github\.token \}\}/);
		assert.match(lastStep, /run: node tools\/publish-release\.mjs --channel "\$CHANNEL" --zip "\$ZIP" --sha "\$COMMIT" --version "\$VERSION"$/m);
	});

	it('builds the ZIP of the channel in the job, from the same action that the others use', () => {
		assert.match(publishJob, /uses: \.\/\.github\/actions\/build-wordpress-plugin\n\s+with:\n\s+channel: \$\{\{ github\.ref_name \}\}/);
		for (const id of ['plugin-check', 'package']) {
			assert.ok(!/channel:/.test((jobs.get(id) ?? []).join('\n')), `${id} builds the development ZIP, with no address`);
		}
	});

	it('writes the console addresses nowhere in the workflows and the action: they live in tools/publish-release.mjs, once', () => {
		const files = [join(WORKFLOWS, 'wordpress-plugin.yml'), join(WORKFLOWS, 'wordpress-plugin-release.yml'), join(REPOSITORY, '.github', 'actions', 'build-wordpress-plugin', 'action.yml')];
		for (const file of files) {
			const text = readFileSync(file, 'utf8');
			for (const [channel, { appOrigin }] of Object.entries(CHANNELS)) {
				assert.ok(!text.includes(new URL(appOrigin).host), `${basename(file)} repeats the address of the channel ${channel}`);
			}
		}
		// The versioned release is a production ZIP, and still the only other workflow that writes.
		const release = readFileSync(files[1], 'utf8');
		assert.match(release, /^ {10}channel: main\r?$/m);
		assert.deepEqual(topLevelBlock(release, 'permissions'), ['  contents: write']);
		assert.match(release, /tags:\r?\n\s+- 'wp-plugin-v\*'/);
	});

	it('the documentation says where the two ZIPs are', () => {
		const docs = join(REPOSITORY, 'docs', 'technical', 'wordpress-plugin.md');
		assert.ok(existsSync(docs), 'docs/technical/wordpress-plugin.md');
		const text = readFileSync(docs, 'utf8');
		assert.match(text, /^## Canali di pubblicazione\r?$/m);
		for (const channel of Object.keys(CHANNELS)) {
			assert.ok(text.includes(`https://github.com/casazen/frontend/releases/download/${releaseTag(channel)}/casazen.zip`), `the address of the ZIP of ${channel}`);
			assert.ok(text.includes(appOriginOf(channel)), `the console of ${channel}`);
		}
	});
});
