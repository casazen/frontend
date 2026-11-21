<?php
/**
 * Plugin bootstrap: wires the other classes to WordPress.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Boots the plugin. The PHP is thin on purpose: the widget behaviour lives in the loader script that CasaZen serves.
 */
class Plugin {

	/**
	 * The cron event of the plugin: it runs Connection::refresh() in the background.
	 *
	 * @var string
	 */
	const CRON_EVENT = 'casazen_refresh_connection';

	/**
	 * Registers the hooks of the plugin (on plugins_loaded). No translated string is evaluated here.
	 *
	 * @return void
	 */
	public static function init() {
		Settings::init();
		add_action( self::CRON_EVENT, array( __NAMESPACE__ . '\\Connection', 'refresh' ) );

		// The widgets: the shortcodes, the blocks, the loader script and the places of the search bar.
		Shortcodes::init();
		Blocks::init();
		Assets::init();
		Destinations::init();

		if ( is_admin() ) {
			Admin::init();
		}
	}

	/**
	 * Loads the translations of the plugin (on init: WordPress 6.7 warns about earlier loading).
	 *
	 * @return void
	 */
	public static function load_textdomain() {
		load_plugin_textdomain( 'casazen', false, dirname( plugin_basename( CASAZEN_FILE ) ) . '/languages' );
	}

	/**
	 * Activation: creates the option with its defaults and autoload off.
	 *
	 * On a network activation only the main site gets it here; every other site creates it with its first save.
	 *
	 * @return void
	 */
	public static function activate() {
		Settings::install();
	}

	/**
	 * Deactivation: clears the cron events of the plugin, on every site of a network when it was network-deactivated.
	 *
	 * @param bool $network_wide Whether the plugin was deactivated for the whole network.
	 * @return void
	 */
	public static function deactivate( $network_wide = false ) {
		if ( is_multisite() && $network_wide ) {
			$offset = 0;
			do {
				$site_ids = get_sites(
					array(
						'fields' => 'ids',
						'number' => 100,
						'offset' => $offset,
					)
				);
				foreach ( $site_ids as $site_id ) {
					switch_to_blog( (int) $site_id );
					self::unschedule_events();
					restore_current_blog();
				}
				$offset += 100;
			} while ( 100 === count( $site_ids ) );
			return;
		}
		self::unschedule_events();
	}

	/**
	 * Clears every cron event of the plugin on the current site.
	 *
	 * @return void
	 */
	private static function unschedule_events() {
		wp_unschedule_hook( self::CRON_EVENT );
		wp_unschedule_hook( Destinations::CRON_EVENT );
	}
}
