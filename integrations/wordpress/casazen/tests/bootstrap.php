<?php
/**
 * PHPUnit bootstrap: loads the WordPress test library and the plugin.
 *
 * The library comes from the folder in `WP_TESTS_DIR`, or from `/tmp/wordpress-tests-lib` (the folder that
 * `bin/install-wp-tests.sh` of WordPress fills).
 *
 * @package Casazen
 */

$casazen_tests_dir = getenv( 'WP_TESTS_DIR' );
if ( ! $casazen_tests_dir ) {
	$casazen_tests_dir = '/tmp/wordpress-tests-lib';
}

// The WordPress test library needs the PHPUnit Polyfills: take the path from the environment or from Composer.
$casazen_polyfills = getenv( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH' );
if ( ! $casazen_polyfills && is_readable( dirname( __DIR__ ) . '/vendor/yoast/phpunit-polyfills/phpunitpolyfills-autoload.php' ) ) {
	$casazen_polyfills = dirname( __DIR__ ) . '/vendor/yoast/phpunit-polyfills';
}
if ( $casazen_polyfills && ! defined( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH' ) ) {
	define( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH', $casazen_polyfills );
}

if ( ! file_exists( $casazen_tests_dir . '/includes/functions.php' ) ) {
	fwrite( STDERR, "Could not find {$casazen_tests_dir}/includes/functions.php: set WP_TESTS_DIR to the WordPress test library.\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	exit( 1 );
}

// Gives access to tests_add_filter().
require_once $casazen_tests_dir . '/includes/functions.php';

// The tests never reach the network: a request that no test stubbed (an earlier filter did not answer) fails at once.
tests_add_filter(
	'pre_http_request',
	static function ( $preempt ) {
		if ( false !== $preempt ) {
			return $preempt;
		}
		return new WP_Error( 'casazen_tests_no_network', 'The tests do not use the network.' );
	},
	99
);

// Loads the plugin before WordPress starts, like a plugin that is active.
tests_add_filter(
	'muplugins_loaded',
	static function () {
		require dirname( __DIR__ ) . '/casazen.php';
	}
);

// Starts the WordPress test environment.
require $casazen_tests_dir . '/includes/bootstrap.php';
