#!/usr/bin/env node
/**
 * Development tool, not shipped in the plugin ZIP.
 *
 * The version of the plugin is written in three places and, for a release, in the name of the tag. They must be one string:
 *
 *   1. the `Version:` header of casazen.php (what WordPress shows in the list of plugins);
 *   2. the constant CASAZEN_VERSION of casazen.php (the user agent of the requests and the cache of assets);
 *   3. the `Stable tag:` of readme.txt;
 *   4. the release tag, `wp-plugin-v<version>`, when `--tag` is given (the release workflow gives the tag it runs for).
 *
 * Output: one line per problem on stderr. Exit code 1 when the strings differ, are not a version or do not match the tag, 0 otherwise.
 *
 * Usage: node tools/check-version.mjs [--tag wp-plugin-v0.1.0]
 */
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The prefix of a release tag. It cannot clash with the tags of the application. */
export const TAG_PREFIX = 'wp-plugin-v';

/** A version: three numbers, and optionally a pre-release suffix (`0.2.0-rc.1`). */
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?$/;

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Reads the three version strings of the plugin.
 *
 * @param {string} root The folder of the plugin (the one with casazen.php).
 * @returns {{ label: string, value: string | null }[]} Where each string was read from; `value` is null when it was not found.
 */
export function readVersions(root = PLUGIN_ROOT) {
	const main = readFileSync(resolve(root, 'casazen.php'), 'utf8');
	const readme = readFileSync(resolve(root, 'readme.txt'), 'utf8');

	// The header is the first comment block of the file, before any code.
	const headerEnd = main.indexOf('*/');
	const header = headerEnd >= 0 ? main.slice(0, headerEnd + 2) : main.slice(0, 8192);
	const headerMatch = /^[ \t]*\*?[ \t]*Version:[ \t]*(\S+)[ \t]*\r?$/m.exec(header);
	const constantMatch = /define\(\s*'CASAZEN_VERSION'\s*,\s*'([^']*)'\s*\)/.exec(main);
	const stableMatch = /^Stable tag:[ \t]*(\S+)[ \t]*\r?$/im.exec(readme);

	return [
		{ label: 'the Version header of casazen.php', value: headerMatch ? headerMatch[1] : null },
		{ label: 'the constant CASAZEN_VERSION of casazen.php', value: constantMatch ? constantMatch[1] : null },
		{ label: 'the Stable tag of readme.txt', value: stableMatch ? stableMatch[1] : null },
	];
}

/**
 * Checks that the version strings are one valid version and, when a tag is given, that the tag is `wp-plugin-v<version>`.
 *
 * @param {object} [options]
 * @param {string} [options.root] The folder of the plugin.
 * @param {string} [options.tag] The name of the release tag. Empty or missing: no tag to match.
 * @returns {{ ok: boolean, version: string | null, problems: string[] }} `version` is the one version when the strings agree.
 */
export function checkVersions({ root = PLUGIN_ROOT, tag = '' } = {}) {
	const problems = [];
	const found = readVersions(root);

	for (const { label, value } of found) {
		if (value === null) {
			problems.push(`Could not read ${label}.`);
		} else if (!VERSION_PATTERN.test(value)) {
			problems.push(`${label} is "${value}", which is not a version such as 0.1.0.`);
		}
	}

	const values = found.map(({ value }) => value);
	const readable = values.filter((value) => value !== null);
	const agree = readable.length === found.length && new Set(readable).size === 1;
	if (readable.length === found.length && !agree) {
		problems.push(`The version is not the same everywhere: ${found.map(({ label, value }) => `${label} says ${value}`).join('; ')}.`);
	}

	const version = agree ? readable[0] : null;
	if (tag !== '' && tag !== undefined) {
		if (!tag.startsWith(TAG_PREFIX)) {
			problems.push(`The tag "${tag}" does not start with ${TAG_PREFIX}: a release tag looks like ${TAG_PREFIX}<version>.`);
		} else if (version !== null && tag.slice(TAG_PREFIX.length) !== version) {
			problems.push(`The tag "${tag}" does not match the version of the plugin: its version is ${version}, so the tag must be ${TAG_PREFIX}${version}.`);
		} else if (version === null && !VERSION_PATTERN.test(tag.slice(TAG_PREFIX.length))) {
			problems.push(`The tag "${tag}" does not end with a version such as 0.1.0.`);
		}
	}

	return { ok: problems.length === 0, version, problems };
}

function readTagArgument(argv) {
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === '--tag') return argv[index + 1] ?? '';
		if (argument.startsWith('--tag=')) return argument.slice('--tag='.length);
	}
	return '';
}

function main() {
	const argv = process.argv.slice(2);
	const unknown = argv.filter((argument, index) => !(argument === '--tag' || argument.startsWith('--tag=') || argv[index - 1] === '--tag'));
	if (unknown.length > 0) {
		console.error(`Unknown argument: ${unknown.join(' ')}. Usage: node tools/check-version.mjs [--tag ${TAG_PREFIX}0.1.0]`);
		process.exit(2);
	}

	const tag = readTagArgument(argv);
	const { ok, version, problems } = checkVersions({ tag });
	if (!ok) {
		for (const problem of problems) console.error(`check-version: ${problem}`);
		process.exit(1);
	}
	console.log(`check-version: the plugin is version ${version} in the header, the constant and the Stable tag${tag ? `, and the tag is ${tag}` : ''}.`);
}

// Run as a command, not when another tool or a test imports the functions. The check is by file name, so that a path written
// another way (a symbolic link, another case on Windows) can never turn the command into a silent success.
if (basename(process.argv[1] ?? '') === 'check-version.mjs') {
	main();
}
