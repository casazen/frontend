<?php
/**
 * Uninstall: removes everything the plugin stored.
 *
 * It deletes the option `casazen_settings`, the option `casazen_wizard_state` (written by the guided setup), every transient
 * (and its timeout) whose name starts with `casazen_`, and the cron events of the plugin, on every site of a network.
 * It does NOT delete the pages created by the guided setup, nor their meta: they are the agency's content.
 *
 * This file runs without the rest of the plugin loaded, so it uses the names literally.
 *
 * @package Casazen
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

$casazen_uninstall_site = static function () {
	global $wpdb;

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
	} while ( 100 === count( $casazen_site_ids ) );
} else {
	$casazen_uninstall_site();
}
