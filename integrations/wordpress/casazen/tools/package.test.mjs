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
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { blockNames, buildZip, listZip, parseDistignore, verifyEntries, isIgnored } from './build-zip.mjs';
import { builtBlockScripts, checkTranslations, parsePo, readTextDomain, scriptTranslationFileName } from './check-translations.mjs';
import { checkVersions, readVersions, TAG_PREFIX } from './check-version.mjs';

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
		for (const [path, directory] of [['casazen.php', false], ['uninstall.php', false], ['includes', true], ['blocks/build', true], ['blocks/build/booking/block.json', false], ['languages', true], ['readme.txt', false], ['license.txt', false]]) {
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
