<?php
/**
 * Where the CasaZen console is: the web app the administrator is sent to, to connect the site.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * The origin of the CasaZen console, in this order:
 *
 * 1. the constant `CASAZEN_APP_ORIGIN` of wp-config.php, when it is a valid origin (a test install points at the test console);
 * 2. `includes/build-config.php`, which tools/build-zip.mjs writes into the published ZIP (`return array( 'app_origin' => … );`): the
 *    ZIP of each channel carries the console of its own environment. The file is never in the repository;
 * 3. the production console, https://www.casazen.space.
 *
 * A valid origin is an address that Settings::normalise_address() accepts: https, or http for a development host only, without a
 * user name or a password. Only its origin (scheme, host and port) is kept.
 */
class Build_Config {

	/**
	 * The console of production: the address when nothing else says where the console is.
	 *
	 * @var string
	 */
	const DEFAULT_APP_ORIGIN = 'https://www.casazen.space';

	/**
	 * The constant of wp-config.php that names another console (a test install).
	 *
	 * @var string
	 */
	const CONSTANT = 'CASAZEN_APP_ORIGIN';

	/**
	 * The file of the published ZIP that names the console of its channel, below the plugin folder.
	 *
	 * @var string
	 */
	const FILE = 'includes/build-config.php';

	/**
	 * The origin of the CasaZen console for this install.
	 *
	 * @return string An origin, for example https://www.casazen.space.
	 */
	public static function app_origin() {
		return self::resolve( defined( self::CONSTANT ) ? constant( self::CONSTANT ) : null, CASAZEN_DIR . self::FILE );
	}

	/**
	 * The first valid origin of: the value of the constant, the file of the ZIP, the console of production.
	 *
	 * @param mixed  $constant The value of the constant, or null when it is not defined.
	 * @param string $file     The path of the file of the ZIP (it may not exist).
	 * @return string
	 */
	public static function resolve( $constant, $file ) {
		$origin = self::origin( $constant );
		if ( '' !== $origin ) {
			return $origin;
		}
		$origin = self::origin( self::from_file( $file ) );
		return '' !== $origin ? $origin : self::DEFAULT_APP_ORIGIN;
	}

	/**
	 * The address that the file of the ZIP returns.
	 *
	 * @param string $file The path of the file.
	 * @return string The address, or an empty string when there is no such file or it does not return one.
	 */
	public static function from_file( $file ) {
		if ( ! is_string( $file ) || '' === $file || ! is_readable( $file ) ) {
			return '';
		}
		$config = include $file;
		if ( ! is_array( $config ) || ! isset( $config['app_origin'] ) || ! is_string( $config['app_origin'] ) ) {
			return '';
		}
		return $config['app_origin'];
	}

	/**
	 * The origin of an address, when it is an address the plugin may send an administrator to.
	 *
	 * @param mixed $value The address.
	 * @return string The origin, or an empty string when the value is not a valid address.
	 */
	public static function origin( $value ) {
		if ( ! is_string( $value ) || '' === trim( $value ) ) {
			return '';
		}
		$origin = Settings::normalise_address( $value );
		return is_wp_error( $origin ) ? '' : $origin;
	}

	/**
	 * An address of the console: its origin and a path.
	 *
	 * @param string $path The path, starting with a slash (`/app/connect/wordpress`).
	 * @return string
	 */
	public static function console_url( $path ) {
		return self::app_origin() . '/' . ltrim( (string) $path, '/' );
	}
}
