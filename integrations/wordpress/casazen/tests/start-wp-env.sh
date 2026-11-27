#!/usr/bin/env bash
#
# Starts wp-env, and starts it again when it fails: three attempts at most.
#
# `wp-env start` builds the images of the environment on the runner, and that build runs
# `composer global require phpunit/phpunit` INSIDE the image. That composer has no GitHub token, and downloading the packages from
# api.github.com sometimes times out ("curl error 28"): a fault of the network of the runner, not of the plugin, and no variable of
# the job (COMPOSER_AUTH, COMPOSER_PROCESS_TIMEOUT) reaches the build. The layers that were built are kept, so a second attempt only
# repeats what failed. A start that fails three times fails the job, and the output of every attempt stays in the log.
#
# Run it from the folder of the plugin, after `npm ci`:
#
#   bash tests/start-wp-env.sh
set -uo pipefail

ATTEMPTS=3

for attempt in $(seq 1 "$ATTEMPTS"); do
	if npm exec --no -- wp-env start; then
		exit 0
	fi
	echo "::warning::wp-env did not start (attempt $attempt of $ATTEMPTS)." >&2
	if [[ "$attempt" -lt "$ATTEMPTS" ]]; then
		sleep 20
	fi
done

echo "::error::wp-env did not start in $ATTEMPTS attempts." >&2
exit 1
