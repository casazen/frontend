#!/usr/bin/env bash
#
# Smoke test of the CasaZen plugin on a real WordPress (wp-env, the Docker runtime). It is the proof of AC-NF148-1 and AC-NF148-2:
#
#   - the plugin activates with no PHP warning, notice, deprecation or fatal error and no "called incorrectly" in the debug log
#     (first the log is proved to be live: a line that PHP writes on purpose must reach wp-content/debug.log, otherwise an empty
#     log would only mean that nothing can be written, not that nothing went wrong);
#   - the settings are saved and the connection test reports the name of the agency;
#   - a published page with [casazen_booking], [casazen_search] and [casazen_owner_login] prints the three elements, ONE loader
#     script tag with `defer` and the link to the owner area;
#   - Settings, then CasaZen, answers 200 to the administrator and shows the agency (and so does the Guided setup tab);
#   - nothing is asked of the network that the mock does not know;
#   - uninstall removes what the plugin stored.
#
# No outbound network: the mu-plugin tests/smoke/mu-plugins/casazen-mock-http.php, mapped into the site by .wp-env.json (in the
# development environment only), answers the three requests of the plugin with canned JSON and refuses every other request. It also
# gives WordPress the answer of its own update checks ("checked a moment ago, nothing to update"): without it every page of the admin
# would ask api.wordpress.org, and WordPress itself would write three warnings in the debug log that this test reads.
#
# Run it from the folder of the plugin, after `npm ci` and `npm exec --no -- wp-env start`. The versions of PHP and WordPress are the
# ones wp-env was started with (WP_ENV_PHP_VERSION and WP_ENV_CORE). The same script runs on PHP 7.4 and 8.3.
#
#   bash tests/smoke/smoke.sh
#
# Environment: SMOKE_SITE_URL (default http://localhost:8888, the port of wp-env).
set -euo pipefail

SITE="${SMOKE_SITE_URL:-http://localhost:${WP_ENV_PORT:-8888}}"
ADDRESS='https://prenota.example.com'
PLUGIN='casazen'
# The administrator that wp-env creates in its throw-away site: a documented default, not a secret.
ADMIN_USER='admin'
ADMIN_PASSWORD='password'
LOG_PATTERN='PHP (Warning|Notice|Deprecated|Fatal)|_doing_it_wrong|was called incorrectly|casazen-smoke-unexpected-request'

WORK_DIR="$(mktemp -d)"
FAILED=1

fail() {
	echo "::error::smoke: $*" >&2
	exit 1
}

step() {
	echo "== $*"
}

# WP-CLI in the development container. wp-env hands every word of the command to the container as it is (no shell is in between),
# and what follows "--" is not read by wp-env itself, so a JSON value or a PHP snippet needs no quoting beyond the shell of this script.
wpcli() {
	npm exec --no -- wp-env run cli wp -- "$@"
}

# Any other command in the development container (the folder is the root of WordPress): in_site <program> <arguments...>.
in_site() {
	local program="$1"
	shift
	npm exec --no -- wp-env run cli "$program" -- "$@"
}

# The debug log of the site, or nothing when there is none.
debug_log() {
	in_site sh -c 'test -f wp-content/debug.log && cat wp-content/debug.log || true'
}

assert_contains() {
	local file="$1" needle="$2" message="$3"
	grep -q -F -- "$needle" "$file" || fail "$message (looked for: $needle)"
}

on_exit() {
	if [[ "$FAILED" != 0 ]]; then
		echo "== The debug log of the site, last 60 lines" >&2
		debug_log 2>/dev/null | tail -n 60 >&2 || true
	fi
	rm -rf "$WORK_DIR"
}
trap on_exit EXIT

step 'The site'
wpcli eval 'echo "PHP " . PHP_VERSION . ", WordPress " . get_bloginfo( "version" ) . ", environment " . wp_get_environment_type() . "\n";'
MOCK="$(wpcli eval 'echo function_exists( "casazen_smoke_pre_http_request" ) ? "mock network: on" : "mock network: OFF";')"
[[ "$MOCK" == *'mock network: on'* ]] || fail 'The mu-plugin of the mock network is not loaded: check "mappings" in .wp-env.json.'

step 'The debug log is live'
# A canary: PHP writes one line on purpose and it must show up in wp-content/debug.log. Without this proof an empty log at the end
# would not mean "no warning": it could also mean that WP_DEBUG_LOG writes nothing (see "config" in .wp-env.json).
in_site sh -c ': > wp-content/debug.log'
wpcli eval 'error_log( "casazen-smoke-canary" );'
CANARY_LOG="$(debug_log)"
[[ "$CANARY_LOG" == *'casazen-smoke-canary'* ]] || fail 'PHP does not write to wp-content/debug.log: the check of the log at the end would prove nothing (see "config" in .wp-env.json).'

step 'Activate the plugin with an empty log'
wpcli plugin deactivate "$PLUGIN"
in_site sh -c ': > wp-content/debug.log'
wpcli plugin activate "$PLUGIN"
STORED="$(wpcli option get casazen_settings --format=json)"
[[ "$STORED" == *'"address":""'* ]] || fail 'The activation did not create the option casazen_settings with its defaults.'

step 'Save the settings and test the connection'
SETTINGS='{"address":"'"$ADDRESS"'","org_slug":"","language_map":{"it_IT":"it","en_US":"en"},"load_script":true}'
wpcli option update casazen_settings "$SETTINGS" --format=json
# WP-CLI prints JSON the way PHP does, and escapes every slash ("https:\/\/prenota.example.com"): the backslashes (octal 134) are taken
# out before the comparison.
STORED="$(wpcli option get casazen_settings --format=json | tr -d '\134')"
[[ "$STORED" == *"\"address\":\"$ADDRESS\""* ]] || fail "The address was not saved (the option holds: $STORED)."
RESULT="$(wpcli eval 'echo wp_json_encode( Casazen\Connection::refresh() );')"
echo "$RESULT"
for expected in '"ok":true' '"code":"ok"' '"agency":"Agenzia Esempio"' '"embedEnabled":true'; do
	[[ "$RESULT" == *"$expected"* ]] || fail "The connection test did not report what the mock says (looked for: $expected)."
done

step 'A page with the three shortcodes'
PAGE_ID="$(wpcli post create --post_type=page --post_status=publish --post_title='CasaZen smoke test' --post_content='[casazen_booking] [casazen_search] [casazen_owner_login]' --porcelain | grep -E '^[0-9]+$' | tail -n 1 || true)"
[[ "$PAGE_ID" =~ ^[0-9]+$ ]] || fail 'The page was not created.'
PAGE_URL="$(wpcli eval "echo get_permalink( ${PAGE_ID} );" | grep -E '^https?://' | tail -n 1 || true)"
PAGE_PATH="$(printf '%s' "$PAGE_URL" | sed -E 's#^https?://[^/]+##')"
echo "page $PAGE_ID: $PAGE_PATH"
curl --silent --show-error --fail --location --max-time 60 --retry 3 --retry-delay 2 --retry-connrefused --output "$WORK_DIR/page.html" "$SITE$PAGE_PATH" || fail "The page $SITE$PAGE_PATH did not answer."

assert_contains "$WORK_DIR/page.html" 'data-casazen-widget="booking"' 'The booking element is not on the page'
assert_contains "$WORK_DIR/page.html" "data-casazen-base=\"$ADDRESS\"" 'The element does not carry the address of the settings'
assert_contains "$WORK_DIR/page.html" 'data-casazen-widget="search"' 'The search bar element is not on the page'
assert_contains "$WORK_DIR/page.html" 'data-casazen-destinations=' 'The search bar has no places'
assert_contains "$WORK_DIR/page.html" 'Lugano' 'The places of the mock are not in the search bar'
assert_contains "$WORK_DIR/page.html" "href=\"$ADDRESS/portale-proprietari/accedi\"" 'The link to the owner area is not on the page'

# ONE loader script tag, and it has `defer` (the attribute itself: data-no-defer and data-wp-strategy do not count).
LOADER_TAGS="$(grep -o '<script[^>]*embed/v1/embed\.js[^>]*>' "$WORK_DIR/page.html" || true)"
LOADER_COUNT="$(printf '%s' "$LOADER_TAGS" | grep -c . || true)"
[[ "$LOADER_COUNT" == 1 ]] || fail "The page must have exactly one embed.js script tag, it has $LOADER_COUNT."
grep -q -E '[[:space:]]defer([[:space:]=>/]|$)' <<<"$LOADER_TAGS" || fail 'The embed.js script tag has no defer attribute.'
echo "loader: $LOADER_TAGS"

step 'Settings, then CasaZen, as the administrator'
JAR="$WORK_DIR/cookies.txt"
curl --silent --show-error --output /dev/null --cookie-jar "$JAR" "$SITE/wp-login.php" || fail 'The login page did not answer.'
STATUS="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --cookie "$JAR" --cookie-jar "$JAR" \
	--data-urlencode "log=$ADMIN_USER" --data-urlencode "pwd=$ADMIN_PASSWORD" --data-urlencode 'wp-submit=Log In' \
	--data-urlencode "redirect_to=$SITE/wp-admin/" --data-urlencode 'testcookie=1' "$SITE/wp-login.php")"
[[ "$STATUS" == 302 ]] || fail "The login of the administrator answered $STATUS instead of 302."
grep -q 'wordpress_logged_in' "$JAR" || fail 'The login of the administrator did not set the session cookie.'

STATUS="$(curl --silent --show-error --output "$WORK_DIR/settings.html" --write-out '%{http_code}' --cookie "$JAR" "$SITE/wp-admin/options-general.php?page=casazen")"
[[ "$STATUS" == 200 ]] || fail "Settings, then CasaZen answered $STATUS instead of 200."
assert_contains "$WORK_DIR/settings.html" 'id="casazen-status"' 'The status box is not on the settings page'
assert_contains "$WORK_DIR/settings.html" 'Agenzia Esempio' 'The settings page does not show the agency'

STATUS="$(curl --silent --show-error --output "$WORK_DIR/setup.html" --write-out '%{http_code}' --cookie "$JAR" "$SITE/wp-admin/options-general.php?page=casazen&tab=setup")"
[[ "$STATUS" == 200 ]] || fail "The Guided setup tab answered $STATUS instead of 200."
assert_contains "$WORK_DIR/setup.html" 'casazen_wizard[pages]' 'The form of the Guided setup is not on its tab'

step 'Uninstall'
wpcli plugin uninstall "$PLUGIN" --deactivate --skip-delete
if wpcli option get casazen_settings >/dev/null 2>&1; then
	fail 'The option casazen_settings is still there after the uninstall.'
fi
LEFT="$(wpcli option list --search='*casazen*' --format=count | grep -E '^[0-9]+$' | tail -n 1 || true)"
[[ "$LEFT" == 0 ]] || fail "$LEFT options or transients of the plugin are left after the uninstall."
EVENTS="$(wpcli cron event list --fields=hook --format=csv)"
[[ "$EVENTS" != *'casazen_'* ]] || fail 'A scheduled event of the plugin is left after the uninstall.'

step 'The debug log'
debug_log >"$WORK_DIR/debug.log"
echo "$(wc -l <"$WORK_DIR/debug.log") lines in wp-content/debug.log"
if grep -n -E "$LOG_PATTERN" "$WORK_DIR/debug.log"; then
	fail 'The debug log of the site has a PHP warning, notice, deprecation or fatal error, a "called incorrectly", or a request that the mock does not know (see above).'
fi

FAILED=0
echo 'smoke: OK'
