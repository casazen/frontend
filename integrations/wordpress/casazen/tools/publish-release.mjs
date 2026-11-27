#!/usr/bin/env node
/**
 * Development tool, not shipped in the plugin ZIP.
 *
 * Publishes the ZIP of the plugin on one of two CHANNELS, as the asset `casazen.zip` of a rolling GitHub release, so that the console of
 * CasaZen can link a stable address and the admin of an agency downloads the plugin with no release step:
 *
 *   develop  the release `wp-plugin-develop`, a pre-release; its ZIP carries the address of the TEST console
 *   main     the release `wp-plugin-main`, never marked "latest"; its ZIP carries the address of the PRODUCTION console
 *
 * The address of the asset never changes: https://github.com/casazen/frontend/releases/download/wp-plugin-<channel>/casazen.zip
 *
 * The release is created once. After that only its asset and its notes change. The tag is made by the creation, at the commit that was
 * published first, and nothing here moves, removes or recreates it. `gh release upload --clobber` replaces the asset of the same name.
 * (GitHub names the asset after the FILE, and `file#text` only sets a display label: so the ZIP is copied to a file called `casazen.zip`
 * next to the original, and that file is uploaded.)
 *
 * The logic is in functions that take the commands they run as an argument, so that it is tested without GitHub (package.test.mjs).
 * With `--dry-run` it prints the commands and runs none, and does not contact GitHub.
 *
 * Before anything is written to GitHub the ZIP is read back and must carry the address of the console of ITS channel: a ZIP built for
 * production can never go out as the test one, or the other way round.
 *
 * Just before the first write the commit is checked too: it must still be the one to publish, so that a re-run of an old run never puts an
 * old ZIP over a newer one. The tip of the branch of the channel is read (`gh api repos/<repository>/commits/<branch>`). When it is this
 * commit, all is well. When it is another one, the branch has moved on, and what counts is whether the PLUGIN moved with it (the files that
 * start the workflow, see startsPluginWorkflow): a newer commit that changes the plugin starts a run of its own, which publishes, so this run
 * steps aside (a `::notice::`, exit 0: two merges close together are a normal race, not a failure); newer commits that change nothing of the
 * plugin start no run, so this one is the last publication there will be and it goes on. A tip that cannot be read, or a comparison that
 * cannot say, is an error (exit 1): nothing is written on a guess.
 *
 * Usage:
 *   node tools/publish-release.mjs --channel develop|main --zip <path> --sha <commit> --version <x.y.z> [--dry-run]
 *   node tools/publish-release.mjs --channel develop|main --print-app-origin     (prints the address of the console of that channel)
 *
 * It reads no secret. `gh` takes the token from GH_TOKEN, and the repository from GH_REPO (the workflow sets both).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { BUILD_CONFIG_PATH, TOP_FOLDER, listZip, parseAppOrigin, readBuildConfigOrigin, readZipEntry } from './build-zip.mjs';
import { VERSION_PATTERN } from './check-version.mjs';

/**
 * THE place of the two channels: their names (they are the branches that publish) and the address of the console that the ZIP of each one
 * carries. The workflows read the address from here (`--print-app-origin`), so it is written nowhere else. A ZIP of a versioned release
 * (the tag `wp-plugin-v<version>`) is a production ZIP: it carries the address of `main`.
 */
export const CHANNELS = Object.freeze({
	develop: Object.freeze({ appOrigin: 'https://casazen-test-app.vercel.app', prerelease: true }),
	main: Object.freeze({ appOrigin: 'https://www.casazen.space', prerelease: false }),
});

/** The tag of the release of a channel is this prefix and the channel. It does not start with `wp-plugin-v`, the prefix of the versioned releases. */
export const RELEASE_TAG_PREFIX = 'wp-plugin-';

/** The name of the asset: the last part of the address that the console links. */
export const ASSET_NAME = 'casazen.zip';

/** A full commit: GitHub makes the tag of a new release at exactly this commit. */
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;

/**
 * The settings of a channel.
 *
 * @param {unknown} name
 * @returns {{ appOrigin: string, prerelease: boolean }}
 * @throws {Error} For a channel that is not one of CHANNELS.
 */
export function channelOf(name) {
	if (typeof name === 'string' && Object.hasOwn(CHANNELS, name)) return CHANNELS[name];
	throw new Error(`Unknown channel ${JSON.stringify(name ?? null)}: the channels are ${Object.keys(CHANNELS).join(' and ')}.`);
}

/** The tag, and so the name, of the rolling release of a channel: `wp-plugin-develop` or `wp-plugin-main`. */
export function releaseTag(channel) {
	channelOf(channel);
	return `${RELEASE_TAG_PREFIX}${channel}`;
}

/** The address of the CasaZen console that the ZIP of a channel carries (checked: it must be a valid `--app-origin`). */
export function appOriginOf(channel) {
	return parseAppOrigin(channelOf(channel).appOrigin);
}

function checkCommit(sha) {
	if (typeof sha !== 'string' || !COMMIT_PATTERN.test(sha)) {
		throw new Error(`--sha must be a full commit (40 lowercase hexadecimal characters), not ${JSON.stringify(sha ?? null)}.`);
	}
}

function checkVersion(version) {
	if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
		throw new Error(`--version must be a version such as 0.1.0, not ${JSON.stringify(version ?? null)}.`);
	}
}

/**
 * The notes of the release: the commit, the version of the plugin and the date of the publication.
 *
 * @param {object} options
 * @param {string} options.channel
 * @param {string} options.sha The commit the ZIP was built from.
 * @param {string} options.version The version of the plugin.
 * @param {Date} [options.now] The time of the publication.
 */
export function releaseNotes({ channel, sha, version, now = new Date() }) {
	const origin = appOriginOf(channel);
	checkCommit(sha);
	checkVersion(version);
	const published = `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
	return [
		`Rolling build of the CasaZen WordPress plugin, channel ${channel}. Every publication replaces the ZIP; the tag of this release does not move.`,
		'',
		`- Commit: ${sha}`,
		`- Plugin version: ${version}`,
		`- Published: ${published}`,
		`- CasaZen console written into the package: ${origin}`,
	].join('\n');
}

/** The flags that keep a channel what it is: a pre-release for `develop`, never "latest" for `main`. */
function releaseKindFlags(channel) {
	return channelOf(channel).prerelease ? ['--prerelease'] : ['--latest=false'];
}

/** The command that asks whether the release of a channel exists. */
export function probeCommand(channel) {
	return ['gh', 'release', 'view', releaseTag(channel), '--json', 'tagName'];
}

/**
 * Reads the answer of the probe command: the release exists, does not exist, or the question itself failed (the network, the token, ...),
 * in which case nothing is created: a failed question is not "no".
 *
 * @param {{ status: number | null, stderr?: string, error?: Error }} answer
 * @returns {boolean}
 */
export function releaseExistsFrom({ status, stderr = '', error } = {}) {
	if (error) throw new Error(`could not run gh: ${error.message}`);
	if (status === 0) return true;
	if (/release not found/i.test(stderr)) return false;
	throw new Error(`gh release view failed (exit ${status}), so nothing was created or changed: ${String(stderr).trim() || 'no message'}`);
}

/**
 * The commands that publish the ZIP, in order. The release is created once, with its notes; every publication replaces the asset
 * `casazen.zip`; a release that exists also gets the new notes. Nothing here forces, removes or moves a tag.
 *
 * @param {object} options
 * @param {string} options.channel `develop` or `main`.
 * @param {string} options.sha The commit of the publication (the tag of a NEW release is made there).
 * @param {string} options.version The version of the plugin.
 * @param {string} options.assetPath The file to upload: its name must be `casazen.zip` (GitHub names the asset after the file).
 * @param {boolean} options.releaseExists The answer of the probe command.
 * @param {Date} [options.now]
 * @returns {string[][]} Each command as a list of words, `gh` first.
 */
export function planPublish({ channel, sha, version, assetPath, releaseExists, now = new Date() }) {
	const tag = releaseTag(channel);
	if (basename(assetPath) !== ASSET_NAME) {
		throw new Error(`The file to upload must be called ${ASSET_NAME}, not ${basename(assetPath)}: GitHub names the asset after the file, and the console links that name.`);
	}
	const notes = releaseNotes({ channel, sha, version, now });
	const upload = ['gh', 'release', 'upload', tag, assetPath, '--clobber'];

	if (!releaseExists) {
		return [['gh', 'release', 'create', tag, '--target', sha, ...releaseKindFlags(channel), '--title', `CasaZen WordPress plugin (${channel})`, '--notes', notes], upload];
	}
	return [upload, ['gh', 'release', 'edit', tag, '--notes', notes, ...releaseKindFlags(channel)]];
}

/** A word of a command, quoted for a POSIX shell only when it needs it, so that what is printed can be pasted. */
export function shellQuote(word) {
	return /^[A-Za-z0-9_@%+=:,./#-]+$/.test(word) ? word : `'${word.replaceAll("'", "'\\''")}'`;
}

/** A command as one line (the notes make it span lines inside quotes). */
export function formatCommand(command) {
	return command.map(shellQuote).join(' ');
}

/**
 * Checks that a ZIP is the ZIP of a channel: it must carry the address of the console of that channel in `includes/build-config.php`.
 *
 * @param {string} zipPath
 * @param {string} channel
 * @returns {string[]} What is wrong; an empty list means the ZIP may go out on that channel.
 */
export function verifyZipForChannel(zipPath, channel) {
	const expected = appOriginOf(channel);
	if (!existsSync(zipPath)) return [`${zipPath} does not exist: build it first (node tools/build-zip.mjs --app-origin ${expected}).`];

	const name = `${TOP_FOLDER}/${BUILD_CONFIG_PATH}`;
	let content;
	try {
		content = listZip(zipPath).some((entry) => entry.name === name) ? readZipEntry(zipPath, name) : null;
	} catch (error) {
		return [`${zipPath} cannot be read as a ZIP: ${error.message}`];
	}
	if (content === null) return [`The ZIP has no ${name}: it carries no address of the console. Build it with --app-origin ${expected}.`];

	const found = readBuildConfigOrigin(content.toString('utf8'));
	if (found !== expected) {
		return [`The ZIP is built for ${found ?? 'no valid console address'} but the channel ${channel} publishes the one of ${expected}: a plugin downloaded from an environment must connect to that environment.`];
	}
	return [];
}

/**
 * The files whose change starts the workflow "WordPress plugin" on a push: `on.push.paths` of .github/workflows/wordpress-plugin.yml (a test
 * keeps the two lists in step). A commit that changes none of them starts no run, so it can never be the commit of a newer publication.
 */
const PLUGIN_PATH_PREFIXES = Object.freeze(['integrations/wordpress/', '.github/actions/build-wordpress-plugin/']);
const PLUGIN_WORKFLOW_FILE = /^\.github\/workflows\/wordpress-plugin[^/]*\.yml$/;

/** Whether a change of this file (a path of the repository, with forward slashes) starts the workflow of the plugin. */
export function startsPluginWorkflow(file) {
	return typeof file === 'string' && (PLUGIN_PATH_PREFIXES.some((prefix) => file.startsWith(prefix)) || PLUGIN_WORKFLOW_FILE.test(file));
}

/** `owner/name` for the path of the API; anything else (a host in front, nothing) is left to `gh`, which fills `{owner}/{repo}` from GH_REPO or the checkout. */
function repositoryPath(repository) {
	return /^[\w.-]+\/[\w.-]+$/.test(repository) ? repository : '{owner}/{repo}';
}

/** The command that reads the commit at the tip of the branch of a channel (a channel is named after its branch). It only reads. */
export function tipCommand(channel, repository = '') {
	channelOf(channel);
	return ['gh', 'api', `repos/${repositoryPath(repository)}/commits/${channel}`, '--jq', '.sha'];
}

/** GitHub lists at most this many files, and 250 commits, of a comparison: a longer one cannot prove that the plugin did not change. */
const GITHUB_MAX_FILES = 300;

/**
 * The command that lists what changed between the commit that is being published and the tip of the branch of its channel. It only reads.
 * The answer is the JSON of GitHub as it is (`status`, `total_commits`, `commits`, `files`); it is read here, not with a `--jq`, so that what is
 * kept of it is proved by a test and not by a filter that nothing here can run.
 */
export function changesCommand(channel, sha, repository = '') {
	channelOf(channel);
	checkCommit(sha);
	return ['gh', 'api', `repos/${repositoryPath(repository)}/compare/${sha}...${channel}`];
}

/**
 * Reads the answer of the tip command: the commit at the tip of the branch. A question that failed (the network, the token, ...) or an answer
 * that is not a commit stops the publication: a commit that may no longer be the latest is not written over the ZIP of the release.
 *
 * @param {{ status: number | null, stdout?: string, stderr?: string, error?: Error }} answer
 * @param {string} channel
 * @returns {string} The commit at the tip of the branch.
 * @throws {Error} When the tip cannot be read.
 */
export function readTip({ status, stdout = '', stderr = '', error } = {}, channel) {
	if (error) throw new Error(`could not run gh to read the tip of the branch ${channel}: ${error.message}. Nothing was published.`);
	const tip = String(stdout).trim();
	if (status !== 0 || !COMMIT_PATTERN.test(tip)) {
		throw new Error(`could not read the tip of the branch ${channel} (gh api exit ${status}: ${String(stderr).trim() || tip || 'no message'}). Nothing was published, because this commit may no longer be the latest.`);
	}
	return tip;
}

/**
 * Reads the answer of the compare command: the files that changed between the commit and the tip of the branch. Anything but "the tip is
 * ahead of the commit, and the list is whole" is an error: a list that may be cut cannot prove that the plugin did not change.
 *
 * @param {{ status: number | null, stdout?: string, stderr?: string, error?: Error }} answer
 * @param {string} channel
 * @returns {string[]} The names of the files that changed (the old name of a renamed file too).
 * @throws {Error} When the answer cannot be read or cannot be trusted.
 */
export function readChanges({ status, stdout = '', stderr = '', error } = {}, channel) {
	if (error) throw new Error(`could not run gh to compare the commit with the tip of the branch ${channel}: ${error.message}. Nothing was published.`);
	let answer = null;
	try {
		answer = JSON.parse(String(stdout));
	} catch {
		answer = null;
	}
	// A list of files that is missing is not an empty list: only a list that is there can say that the plugin did not change.
	if (status !== 0 || answer === null || typeof answer !== 'object' || !Array.isArray(answer.files) || !Array.isArray(answer.commits) || !Number.isInteger(answer.total_commits)) {
		throw new Error(`could not read what changed between the commit and the tip of the branch ${channel} (gh api exit ${status}: ${String(stderr).trim() || 'the answer has no list of files, no list of commits or no count'}). Nothing was published.`);
	}
	if (answer.status !== 'ahead') {
		throw new Error(`the tip of the branch ${channel} is not ahead of the commit (GitHub says ${JSON.stringify(answer.status ?? null)}): the branch was rewritten or the commit is not on it. Nothing was published.`);
	}
	if (answer.files.length >= GITHUB_MAX_FILES || answer.total_commits > answer.commits.length) {
		throw new Error(`there are too many changes between the commit and the tip of the branch ${channel} to tell whether the plugin changed. Nothing was published.`);
	}
	return answer.files.flatMap((file) => [file?.filename, file?.previous_filename]).filter((name) => typeof name === 'string');
}

/**
 * Whether the commit that is being published is still the one to publish. The tip of the branch is read first. When it is this commit, it is.
 * When it is another one, the branch moved on: what counts is whether the plugin moved with it. A newer commit that changes the plugin starts a
 * run of its own, which publishes, so this one is not current; newer commits that change nothing of the plugin start no run, so this one is.
 *
 * @param {object} options
 * @param {string} options.channel
 * @param {string} options.sha The commit that is being published.
 * @param {string} [options.repository] `owner/name`, for the path of the API.
 * @param {(command: string[]) => { status: number | null, stdout?: string, stderr?: string, error?: Error }} options.run Runs one command.
 * @returns {{ current: boolean, tip: string, newer: boolean, files: string[] }} `newer`: the tip is another commit; `files`: what of the plugin
 *   the newer commits changed (empty when the commit is current).
 * @throws {Error} When the tip, or the changes after the commit, cannot be read: nothing is published on a guess.
 */
export function checkCurrent({ channel, sha, repository = '', run }) {
	const tip = readTip(run(tipCommand(channel, repository)), channel);
	if (tip === sha) return { current: true, tip, newer: false, files: [] };
	const files = readChanges(run(changesCommand(channel, sha, repository)), channel).filter(startsPluginWorkflow);
	return { current: files.length === 0, tip, newer: true, files };
}

/** Runs a command and returns what it printed. A command that fails is an answer, not an exception. */
function runCommand(command) {
	const [program, ...args] = command;
	// The answer about the changes between two commits holds the diff of up to 300 files: room for it (the default is 1 MiB, and a longer answer is an error).
	const result = spawnSync(program, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
	return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error };
}

const toPosix = (path) => path.split(sep).join('/');

/**
 * Publishes the ZIP on a channel (or, with `dryRun`, prints how).
 *
 * @param {object} options
 * @param {string} options.channel
 * @param {string} options.zip The ZIP that `build-zip.mjs --app-origin` wrote.
 * @param {string} options.sha The commit the ZIP was built from.
 * @param {string} options.version The version of the plugin.
 * @param {boolean} [options.dryRun] Print the commands and run none.
 * @param {(command: string[]) => { status: number | null, stdout?: string, stderr?: string, error?: Error }} [options.run] Runs one command (a test passes a stand-in for `gh`).
 * @param {Date} [options.now]
 * @param {string} [options.repository] `owner/name` of the repository: the path of the questions about the tip of the branch, and the stable address of the ZIP that is printed when it is done.
 * @param {(line: string) => void} [options.log]
 * @returns {{ dryRun: boolean, tag: string, created?: boolean, skipped?: boolean, tip?: string, commands: object }} `skipped`: the commit is no longer
 *   the one to publish (a newer commit changed the plugin): nothing was written and it is not an error.
 * @throws {Error} For a ZIP of another channel, a question about the release or the tip of the branch that cannot be answered, or a command that failed.
 */
export function publish({ channel, zip, sha, version, dryRun = false, run = runCommand, now = new Date(), repository = '', log = console.log }) {
	const origin = appOriginOf(channel);
	checkCommit(sha);
	checkVersion(version);
	const tag = releaseTag(channel);
	const zipPath = resolve(zip);
	// GitHub names the asset after the file: the upload is a file called casazen.zip, next to the ZIP that the build wrote.
	const assetPath = toPosix(join(dirname(zipPath), ASSET_NAME));

	log(`publish-release: channel ${channel}, release ${tag}, plugin version ${version}, commit ${sha}, console address ${origin}.`);

	if (dryRun) {
		const create = planPublish({ channel, sha, version, assetPath, releaseExists: false, now });
		const update = planPublish({ channel, sha, version, assetPath, releaseExists: true, now });
		const probe = probeCommand(channel);
		const guard = [tipCommand(channel, repository), changesCommand(channel, sha, repository)];
		log('publish-release: dry run. Nothing is executed and GitHub is not contacted; these are the commands, in order.');
		log('# 1. Is there a release already? The answer decides between 3a and 3b.');
		log(formatCommand(probe));
		log('# 2. Is this commit still the one to publish? Both only read. The second runs only when the tip of the branch is another commit: nothing is written if that');
		log('#    commit and the ones after it changed the plugin (the run of the newest publishes), nor if the answers cannot be read.');
		for (const command of guard) log(formatCommand(command));
		log('# 3a. No release: create it once (its tag is made with it and never touched again), then upload the ZIP as casazen.zip.');
		for (const command of create) log(formatCommand(command));
		log('# 3b. A release: upload the ZIP over the asset of the same name, then write the new commit in the notes.');
		for (const command of update) log(formatCommand(command));
		return { dryRun: true, tag, commands: { probe, guard, create, update } };
	}

	// Before anything is written to GitHub: this ZIP is for this channel.
	const problems = verifyZipForChannel(zipPath, channel);
	if (problems.length > 0) throw new Error(`This ZIP cannot be published on the channel ${channel}:\n  ${problems.join('\n  ')}`);

	const exists = releaseExistsFrom(run(probeCommand(channel)));
	log(exists ? `publish-release: ${tag} exists: the asset and the notes are replaced.` : `publish-release: ${tag} does not exist: it is created now.`);

	const commands = planPublish({ channel, sha, version, assetPath, releaseExists: exists, now });

	// The last thing before the first write: this commit is still the one to publish (see checkCurrent). A re-run of an old run, or a run that
	// waited behind a newer one, steps aside here instead of putting an old ZIP over a new one. An answer that cannot be read throws: nothing is written.
	const state = checkCurrent({ channel, sha, repository, run });
	if (!state.current) {
		const shown = state.files.slice(0, 3).map((file) => file.replace(/[%\r\n]/g, '_')).join(', ');
		log(
			`::notice title=ZIP not published::skipped: ${sha} is no longer the tip of ${channel} (the tip is ${state.tip}, and the commits after ${sha.slice(0, 7)} change the plugin: ${shown}${state.files.length > 3 ? ', ...' : ''}): the run of the most recent commit publishes.`
		);
		return { dryRun: false, tag, skipped: true, tip: state.tip, commands: { probe: probeCommand(channel), run: [] } };
	}
	log(
		state.newer
			? `publish-release: the tip of ${channel} is ${state.tip}, newer than ${sha}, but nothing of the plugin changed since: no other run will publish, so this one does.`
			: `publish-release: ${sha} is the tip of ${channel}.`
	);

	const copied = resolve(assetPath) !== zipPath;
	if (copied) copyFileSync(zipPath, assetPath);
	try {
		for (const command of commands) {
			log(`+ ${formatCommand(command)}`);
			const result = run(command);
			if (result.stdout) log(String(result.stdout).trimEnd());
			if (result.error || result.status !== 0) {
				const reason = result.error ? result.error.message : `exit ${result.status}: ${String(result.stderr ?? '').trim() || 'no message'}`;
				throw new Error(`${command.slice(0, 4).join(' ')} failed (${reason}).`);
			}
		}
	} finally {
		if (copied) rmSync(assetPath, { force: true });
	}
	log(`publish-release: done. ${tag} holds ${ASSET_NAME} for commit ${sha}, plugin version ${version}.`);
	if (/^[\w.-]+\/[\w.-]+$/.test(repository)) log(`publish-release: https://github.com/${repository}/releases/download/${tag}/${ASSET_NAME}`);
	return { dryRun: false, tag, created: !exists, commands: { probe: probeCommand(channel), run: commands } };
}

const USAGE = [
	'node tools/publish-release.mjs --channel develop|main --zip <path> --sha <commit> --version <x.y.z> [--dry-run]',
	'node tools/publish-release.mjs --channel develop|main --print-app-origin',
].join('\n       ');

function main() {
	let values;
	try {
		({ values } = parseArgs({
			args: process.argv.slice(2),
			options: {
				channel: { type: 'string' },
				zip: { type: 'string' },
				sha: { type: 'string' },
				version: { type: 'string' },
				'dry-run': { type: 'boolean' },
				'print-app-origin': { type: 'boolean' },
			},
			strict: true,
			allowPositionals: false,
		}));
	} catch (error) {
		console.error(`publish-release: ${error.message}\nUsage: ${USAGE}`);
		process.exit(2);
	}

	// A wrong or missing argument is a mistake of the command (exit 2), checked before anything is run.
	const printOnly = values['print-app-origin'] === true;
	const missing = (printOnly ? ['channel'] : ['channel', 'zip', 'sha', 'version']).filter((name) => values[name] === undefined || values[name] === '');
	if (missing.length > 0) {
		console.error(`publish-release: missing ${missing.map((name) => `--${name}`).join(', ')}.\nUsage: ${USAGE}`);
		process.exit(2);
	}
	try {
		channelOf(values.channel);
		if (!printOnly) {
			checkCommit(values.sha);
			checkVersion(values.version);
		}
	} catch (error) {
		console.error(`publish-release: ${error.message}`);
		process.exit(2);
	}

	if (printOnly) {
		console.log(appOriginOf(values.channel));
		return;
	}

	try {
		publish({ channel: values.channel, zip: values.zip, sha: values.sha, version: values.version, dryRun: values['dry-run'] === true, repository: process.env.GH_REPO ?? process.env.GITHUB_REPOSITORY ?? '' });
	} catch (error) {
		console.error(`publish-release: ${error.message}`);
		process.exit(1);
	}
}

// Run as a command, not when a test imports the functions (by file name: a path written another way never skips it).
if (basename(process.argv[1] ?? '') === 'publish-release.mjs') {
	main();
}
