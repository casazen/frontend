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
#   - «Connect to CasaZen» sends the browser to the console with a state, the return from the console exchanges the code and reads
#     the account (both against the mock), the screen says «Connected to Agenzia Esempio» and never prints the credential; a domain is
#     saved and its DNS records are shown; «Check now» verifies it and the address of the settings becomes the domain;
#   - nothing is asked of the network that the mock does not know;
#   - uninstall gives the credential back (a DELETE to the mock) and removes what the plugin stored.
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

assert_not_contains() {
	local file="$1" needle="$2" message="$3"
	if grep -q -F -- "$needle" "$file"; then
		fail "$message (found: $needle)"
	fi
}

# The nonce of the form of an action, read from a page of the screen: the hidden field that follows the form tag of that action.
nonce_of() {
	local file="$1" action="$2"
	tr -d '\n' <"$file" \
		| grep -o -E "action=${action}\"[^>]*>[[:space:]]*<input type=\"hidden\" name=\"casazen_nonce\" value=\"[^\"]*\"" \
		| sed -E 's/.*value="([^"]*)"$/\1/' \
		| head -n 1 || true
}

# The Location header of a saved answer.
location_of() {
	grep -i '^location:' "$1" | tail -n 1 | tr -d '\r' | sed -E 's/^[Ll]ocation:[[:space:]]*//' || true
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

step 'Connect to CasaZen (the console and the API of the mock)'
# The credential that the mock gives (casazen_smoke_site_token()): no page of the administrator may ever print it.
TOKEN='czs_SmokeCredentialMustNeverBePrinted0123456789ab'
NONCE="$(nonce_of "$WORK_DIR/settings.html" casazen_connect)"
[[ -n "$NONCE" ]] || fail 'The form «Connect to CasaZen» is not on the settings page.'
STATUS="$(curl --silent --show-error --output /dev/null --dump-header "$WORK_DIR/connect.headers" --write-out '%{http_code}' --cookie "$JAR" \
	--data-urlencode "casazen_nonce=$NONCE" "$SITE/wp-admin/admin-post.php?action=casazen_connect")"
[[ "$STATUS" == 302 ]] || fail "«Connect to CasaZen» answered $STATUS instead of 302."
CONSOLE="$(location_of "$WORK_DIR/connect.headers")"
echo "console: $CONSOLE"
[[ "$CONSOLE" == 'https://app.example.com/app/connect/wordpress?site='* ]] || fail "«Connect to CasaZen» did not send the browser to the console of CASAZEN_APP_ORIGIN ($CONSOLE)."
[[ "$CONSOLE" == *'&method=S256'* ]] || fail 'The address of the console has no S256 method.'
STATE="$(printf '%s' "$CONSOLE" | grep -o -E '[?&]state=[0-9a-f]{64}' | sed -E 's/.*state=//' || true)"
[[ "$STATE" =~ ^[0-9a-f]{64}$ ]] || fail 'The address of the console has no state.'

# The console sends the browser back to the screen with a code and the state: the plugin exchanges the code and reads the account.
STATUS="$(curl --silent --show-error --output /dev/null --dump-header "$WORK_DIR/return.headers" --write-out '%{http_code}' --cookie "$JAR" \
	"$SITE/wp-admin/options-general.php?page=casazen&casazen_code=smoke-code-0123456789abcdef&state=$STATE")"
[[ "$STATUS" == 302 ]] || fail "The return from the console answered $STATUS instead of 302."
[[ "$(location_of "$WORK_DIR/return.headers")" != *casazen_code* ]] || fail 'The code stayed in the address of the screen.'

STATUS="$(curl --silent --show-error --output "$WORK_DIR/connected.html" --write-out '%{http_code}' --cookie "$JAR" "$SITE/wp-admin/options-general.php?page=casazen")"
[[ "$STATUS" == 200 ]] || fail "The screen answered $STATUS after the connection."
assert_contains "$WORK_DIR/connected.html" 'Connected to Agenzia Esempio' 'The screen does not say that the site is connected'
assert_contains "$WORK_DIR/connected.html" 'tab=setup' 'The guided setup is not offered as the next step'
assert_contains "$WORK_DIR/connected.html" 'id="casazen-domain"' 'The section of the domain is not on the screen'
STORED="$(wpcli option get casazen_settings --format=json | tr -d '\134')"
[[ "$STORED" == *'"address":"https://app.example.com"'* && "$STORED" == *'"org_slug":"agenzia-esempio"'* ]] || fail "The address and the slug of the account are not in the settings (the option holds: $STORED)."
[[ "$STORED" != *'czs_'* ]] || fail 'The settings hold a credential.'

step 'A domain, its DNS records, then «Check now»'
NONCE="$(nonce_of "$WORK_DIR/connected.html" casazen_domain_save)"
[[ -n "$NONCE" ]] || fail 'The form of the domain is not on the screen.'
STATUS="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --cookie "$JAR" \
	--data-urlencode "casazen_nonce=$NONCE" --data-urlencode 'casazen_domain=prenota.example.com' "$SITE/wp-admin/admin-post.php?action=casazen_domain_save")"
[[ "$STATUS" == 302 ]] || fail "«Connect domain» answered $STATUS instead of 302."
curl --silent --show-error --fail --output "$WORK_DIR/domain.html" --cookie "$JAR" "$SITE/wp-admin/options-general.php?page=casazen" || fail 'The screen did not answer after the domain was saved.'
for record in '_casazen-verify.prenota.example.com' 'casazen-verify=smoke-txt-value' 'cname.smoke-dns.example.net' 'Waiting for the DNS records' 'data-casazen-poll="1"'; do
	assert_contains "$WORK_DIR/domain.html" "$record" 'The DNS records of the domain are not shown'
done

NONCE="$(nonce_of "$WORK_DIR/domain.html" casazen_domain_verify)"
[[ -n "$NONCE" ]] || fail 'The form «Check now» is not on the screen.'
STATUS="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --cookie "$JAR" \
	--data-urlencode "casazen_nonce=$NONCE" "$SITE/wp-admin/admin-post.php?action=casazen_domain_verify")"
[[ "$STATUS" == 302 ]] || fail "«Check now» answered $STATUS instead of 302."
curl --silent --show-error --fail --output "$WORK_DIR/verified.html" --cookie "$JAR" "$SITE/wp-admin/options-general.php?page=casazen" || fail 'The screen did not answer after the check.'
assert_contains "$WORK_DIR/verified.html" 'Your domain is active' 'The verified domain is not shown as active'
STORED="$(wpcli option get casazen_settings --format=json | tr -d '\134')"
[[ "$STORED" == *'"address":"https://prenota.example.com"'* && "$STORED" == *'"org_slug":""'* ]] || fail "The verified domain did not become the address of the settings (the option holds: $STORED)."

for page in settings connected domain verified; do
	assert_not_contains "$WORK_DIR/$page.html" "$TOKEN" "The page $page printed the credential of the site"
done

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
