<?php
/**
 * Plugin Name:       CasaZen
 * Plugin URI:        https://github.com/casazen/frontend/tree/develop/integrations/wordpress/casazen
 * Description:       Connects your WordPress site to CasaZen, so that your booking engine and your guest area appear on your own pages.
 * Version:           0.2.0
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Author:            CasaZen
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       casazen
 * Domain Path:       /languages
 *
 * @package Casazen
 */

defined( 'ABSPATH' ) || exit;

// A second copy of the plugin (installed under another folder name) must not declare anything twice.
if ( defined( 'CASAZEN_VERSION' ) ) {
	return;
}

define( 'CASAZEN_VERSION', '0.2.0' );
define( 'CASAZEN_FILE', __FILE__ );
define( 'CASAZEN_DIR', plugin_dir_path( __FILE__ ) );
define( 'CASAZEN_URL', plugin_dir_url( __FILE__ ) );

/*
 * One class per file: `Casazen\Foo_Bar` is `includes/class-foo-bar.php` and `Casazen\Compat\Elementor` is
 * `includes/compat/class-elementor.php`. No Composer and no third-party PHP library at runtime.
 */
spl_autoload_register(
	static function ( $class_name ) {
		$prefix = 'Casazen\\';
		if ( 0 !== strpos( $class_name, $prefix ) ) {
			return;
		}

		$parts = explode( '\\', substr( $class_name, strlen( $prefix ) ) );
		$name  = strtolower( str_replace( '_', '-', array_pop( $parts ) ) );
		$dir   = '';
		foreach ( $parts as $part ) {
			$dir .= strtolower( str_replace( '_', '-', $part ) ) . '/';
		}

		$path = CASAZEN_DIR . 'includes/' . $dir . 'class-' . $name . '.php';
		if ( is_readable( $path ) ) {
			require_once $path;
		}
	}
);

add_action( 'plugins_loaded', array( 'Casazen\\Plugin', 'init' ) );
add_action( 'init', array( 'Casazen\\Plugin', 'load_textdomain' ) );
register_activation_hook( __FILE__, array( 'Casazen\\Plugin', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Casazen\\Plugin', 'deactivate' ) );
