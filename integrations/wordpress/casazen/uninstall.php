<?php
/**
 * Uninstall: gives the credential of the site back to CasaZen and removes everything the plugin stored.
 *
 * When the site is connected to CasaZen it first asks CasaZen to revoke its credential (`DELETE /api/site/v1/connection`), once,
 * best effort: a CasaZen that does not answer within 10 seconds, or answers with an error, never stops the uninstall. Then it deletes
 * the option `casazen_link` (the connection and its credential), the option `casazen_settings`, the option `casazen_wizard_state`
 * (written by the guided setup), every transient (and its timeout) whose name starts with `casazen_` (the connection test, the places
 * of the search bar, the copy of the account, the requests of «Connect to CasaZen» and the messages of the screen), and the cron
 * events of the plugin, on every site of a network.
 * It does NOT delete the pages created by the guided setup, nor their meta: they are the agency's content.
 *
 * This file runs without the rest of the plugin loaded, so it uses the names literally.
 *
 * @package Casazen
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

/*
 * The credential of a connected site goes back to CasaZen: one request, https (http only for a development host on a development
 * site, as the plugin decides), no redirect, 10 seconds at most, and its answer is not read. The credential is only in the header.
 */
$casazen_revoke_link = static function () {
	$link = get_option( 'casazen_link' );
	if ( ! is_array( $link ) || empty( $link['token'] ) || ! is_string( $link['token'] ) || empty( $link['api_base'] ) || ! is_string( $link['api_base'] ) ) {
		return;
	}

	$base  = rtrim( $link['api_base'], '/' );
	$parts = wp_parse_url( $base );
	if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
		return;
	}
	$scheme      = strtolower( $parts['scheme'] );
	$host        = strtolower( $parts['host'] );
	$development = ( 'localhost' === $host || '127.0.0.1' === $host || '.test' === substr( $host, -5 ) || '.localhost' === substr( $host, -10 ) )
		&& (bool) apply_filters( 'casazen_allow_development_hosts', in_array( wp_get_environment_type(), array( 'local', 'development' ), true ) );
	if ( 'https' !== $scheme && ! ( 'http' === $scheme && $development ) ) {
		return;
	}

	// The manifest names the API with `/api` at its end (or the bare host): the endpoints are below `/api`.
	$path = isset( $parts['path'] ) ? $parts['path'] : '';
	if ( '/api' !== substr( $path, -4 ) ) {
		$base .= '/api';
	}

	$args = array(
		'method'              => 'DELETE',
		'timeout'             => 10,
		'redirection'         => 0,
		'limit_response_size' => 4096,
		'sslverify'           => true,
		'user-agent'          => 'CasaZen-WordPress/' . ( defined( 'CASAZEN_VERSION' ) ? CASAZEN_VERSION : 'uninstall' ),
		'headers'             => array(
			'Accept'        => 'application/json',
			'Authorization' => 'Bearer ' . $link['token'],
		),
	);
	if ( $development ) {
		wp_remote_request( $base . '/site/v1/connection', $args );
	} else {
		wp_safe_remote_request( $base . '/site/v1/connection', $args );
	}
};

$casazen_uninstall_site = static function () use ( $casazen_revoke_link ) {
	global $wpdb;

	$casazen_revoke_link();
	delete_option( 'casazen_link' );
	delete_option( 'casazen_settings' );
	delete_option( 'casazen_wizard_state' );

	// A transient is stored as two options: `_transient_<name>` and `_transient_timeout_<name>`.
	$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- one cleanup query at uninstall.
		$wpdb->prepare(
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
			$wpdb->esc_like( '_transient_casazen_' ) . '%',
			$wpdb->esc_like( '_transient_timeout_casazen_' ) . '%'
		)
	);

	wp_unschedule_hook( 'casazen_refresh_connection' );
	wp_unschedule_hook( 'casazen_refresh_destinations' );
};

if ( is_multisite() ) {
	$casazen_offset = 0;
	do {
		$casazen_site_ids = get_sites(
			array(
				'fields' => 'ids',
				'number' => 100,
				'offset' => $casazen_offset,
			)
		);
		foreach ( $casazen_site_ids as $casazen_site_id ) {
			switch_to_blog( (int) $casazen_site_id );
			$casazen_uninstall_site();
			restore_current_blog();
		}
		$casazen_offset += 100;
	} while ( isset( $casazen_site_ids[99] ) ); // A full page of 100 sites: there may be more.
} else {
	$casazen_uninstall_site();
}
