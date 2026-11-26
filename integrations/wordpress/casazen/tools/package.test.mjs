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
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { blockNames, buildZip, listZip, parseDistignore, verifyEntries, isIgnored } from './build-zip.mjs';
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
	const main = `<?php\n/**\n * Plugin Name: CasaZen\n * Version:           ${version}\n */\n\ndefine( 'CASAZEN_VERSION', '${version}' );\n`;
	return {
		'casazen.php': main,
		'uninstall.php': '<?php\n',
		'readme.txt': `=== CasaZen ===\nStable tag: ${version}\n`,
		'license.txt': 'GPL',
		'includes/class-plugin.php': '<?php\n',
		'blocks/src/booking/block.json': '{}',
		'blocks/src/booking/index.js': 'export {}',
		'blocks/build/booking/block.json': '{}',
		'blocks/build/booking/index.js': 'x',
		'languages/casazen.pot': '#',
		'languages/casazen-it_IT.po': '#',
		'languages/casazen-it_IT.mo': 'mo',
		'languages/casazen-it_IT-0123456789abcdef0123456789abcdef.json': '{}',
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
			'casazen/languages/casazen-it_IT-0123456789abcdef0123456789abcdef.json',
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
