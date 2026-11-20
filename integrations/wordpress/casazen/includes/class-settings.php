<?php
/**
 * The single option of the plugin, its defaults and its sanitisation.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Settings of the plugin.
 *
 * ONE option (`casazen_settings`, an array, autoload off) registered through the Settings API.
 * `Settings::sanitize()` is the only way in: it keeps the four known keys and nothing else.
 * No secret, token or key is ever stored here (phase 1 has no API key).
 */
class Settings {

	/**
	 * Name of the option.
	 *
	 * @var string
	 */
	const OPTION = 'casazen_settings';

	/**
	 * Option group of the Settings API.
	 *
	 * @var string
	 */
	const GROUP = 'casazen';

	/**
	 * Values a line of the language mapping can point to.
	 *
	 * @var string[]
	 */
	const LANGUAGES = array( 'it', 'en', 'auto' );

	/**
	 * A host name: letters, digits and hyphens in dot separated labels (an IP address of four numbers fits too).
	 *
	 * @var string
	 */
	const HOST_PATTERN = '/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/D';

	/**
	 * The slug of an organisation on the CasaZen domain.
	 *
	 * @var string
	 */
	const SLUG_PATTERN = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/D';

	/**
	 * The code of a language in the mapping: `it`, `it_IT`, `pt-br`.
	 *
	 * @var string
	 */
	const LANGUAGE_CODE_PATTERN = '/^[A-Za-z]{2,3}(?:[_-][A-Za-z0-9]+)?$/D';

	/**
	 * Longest accepted organisation slug.
	 *
	 * @var int
	 */
	const MAX_SLUG_LENGTH = 100;

	/**
	 * Most lines the language mapping can hold.
	 *
	 * @var int
	 */
	const MAX_LANGUAGE_LINES = 100;

	/**
	 * Hooks the settings into WordPress.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'admin_init', array( __CLASS__, 'register' ) );
		add_action( 'add_option_' . self::OPTION, array( __CLASS__, 'on_add' ), 10, 2 );
		add_action( 'update_option_' . self::OPTION, array( __CLASS__, 'on_update' ), 10, 2 );
	}

	/**
	 * The value of every key before anything is saved. These four keys are the only ones ever stored.
	 *
	 * @return array
	 */
	public static function defaults() {
		return array(
			'address'      => '',
			'org_slug'     => '',
			'language_map' => array(),
			'load_script'  => true,
		);
	}

	/**
	 * The settings, merged with the defaults. Reads the option only: it never calls CasaZen.
	 *
	 * @return array
	 */
	public static function get() {
		return self::coerce( get_option( self::OPTION, array() ) );
	}

	/**
	 * Creates the option with its defaults and autoload off. An existing option is left alone.
	 *
	 * @return void
	 */
	public static function install() {
		add_option( self::OPTION, self::defaults(), '', false );
	}

	/**
	 * Merges a stored value with the defaults: known keys only, each with the right type.
	 *
	 * @param mixed $stored The value read from the option.
	 * @return array
	 */
	public static function coerce( $stored ) {
		$settings = self::defaults();
		if ( ! is_array( $stored ) ) {
			return $settings;
		}
		if ( isset( $stored['address'] ) && is_string( $stored['address'] ) ) {
			$settings['address'] = $stored['address'];
		}
		if ( isset( $stored['org_slug'] ) && is_string( $stored['org_slug'] ) ) {
			$settings['org_slug'] = $stored['org_slug'];
		}
		if ( isset( $stored['language_map'] ) && is_array( $stored['language_map'] ) ) {
			$map = array();
			foreach ( $stored['language_map'] as $code => $value ) {
				if ( is_string( $value ) ) {
					$map[ $code ] = $value;
				}
			}
			$settings['language_map'] = $map;
		}
		if ( isset( $stored['load_script'] ) ) {
			$settings['load_script'] = (bool) $stored['load_script'];
		}
		return $settings;
	}

	/**
	 * Registers the setting with the Settings API (hooked on admin_init).
	 *
	 * @return void
	 */
	public static function register() {
		register_setting(
			self::GROUP,
			self::OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( __CLASS__, 'sanitize' ),
				'default'           => self::defaults(),
				'show_in_rest'      => false,
			)
		);
	}

	/**
	 * The only way a value gets into the option.
	 *
	 * A key that is not in the input keeps its previous value. An invalid address, slug or language line is refused with a
	 * settings error and the previous value stays; any key that is not one of the four known ones is dropped.
	 *
	 * @param mixed $input The raw value posted by the settings form (already unslashed by WordPress).
	 * @return array The value to store.
	 */
	public static function sanitize( $input ) {
		$clean = self::get();
		if ( ! is_array( $input ) ) {
			return $clean;
		}

		if ( array_key_exists( 'address', $input ) ) {
			$address = self::normalise_address( $input['address'] );
			if ( is_wp_error( $address ) ) {
				self::report( 'casazen_address', self::address_message( $address->get_error_code() ) );
			} else {
				$clean['address'] = $address;
			}
		}

		if ( array_key_exists( 'org_slug', $input ) ) {
			$slug = self::normalise_slug( $input['org_slug'] );
			if ( false === $slug ) {
				self::report(
					'casazen_org_slug',
					__( 'The organisation slug is not valid: use lower-case letters, numbers and single hyphens, up to 100 characters. The previous value was kept.', 'casazen' )
				);
			} else {
				$clean['org_slug'] = $slug;
			}
		}

		if ( array_key_exists( 'language_map', $input ) ) {
			$parsed                = self::parse_language_map( $input['language_map'] );
			$clean['language_map'] = $parsed['map'];
			if ( ! empty( $parsed['rejected'] ) ) {
				$shown = array();
				foreach ( array_slice( $parsed['rejected'], 0, 3 ) as $line ) {
					$shown[] = esc_html( mb_substr( $line, 0, 40 ) );
				}
				self::report(
					'casazen_language_map',
					sprintf(
						/* translators: %s: the first lines of the language mapping that were ignored. */
						__( 'Some lines of the language mapping were ignored because they are not valid: %s', 'casazen' ),
						implode( ', ', $shown )
					)
				);
			}
		}

		if ( array_key_exists( 'load_script', $input ) ) {
			$clean['load_script'] = filter_var( $input['load_script'], FILTER_VALIDATE_BOOLEAN );
		}

		return $clean;
	}

	/**
	 * Reduces an address to its origin: scheme, host and port.
	 *
	 * Path, query and fragment are dropped, the host is lower-cased and a default port is dropped. Only https is accepted;
	 * http is accepted for development hosts only. An address with a user name or a password, another scheme (javascript:,
	 * ftp:) or no scheme is refused. An empty address is allowed: the plugin is then inert.
	 *
	 * @param mixed $raw The address as typed.
	 * @return string|\WP_Error The origin (empty for no address) or an error whose code says why it was refused.
	 */
	public static function normalise_address( $raw ) {
		if ( ! is_string( $raw ) ) {
			return new \WP_Error( 'address_invalid' );
		}
		$raw = trim( $raw );
		if ( '' === $raw ) {
			return '';
		}
		if ( 1 === preg_match( '/[\x00-\x20\x7F]/', $raw ) ) {
			return new \WP_Error( 'address_invalid' );
		}

		$parts = wp_parse_url( $raw );
		if ( ! is_array( $parts ) ) {
			return new \WP_Error( 'address_invalid' );
		}
		if ( empty( $parts['scheme'] ) ) {
			return new \WP_Error( 'address_scheme' );
		}
		$scheme = strtolower( $parts['scheme'] );
		if ( 'https' !== $scheme && 'http' !== $scheme ) {
			return new \WP_Error( 'address_scheme' );
		}
		if ( array_key_exists( 'user', $parts ) || array_key_exists( 'pass', $parts ) ) {
			return new \WP_Error( 'address_credentials' );
		}
		if ( empty( $parts['host'] ) || ! is_string( $parts['host'] ) ) {
			return new \WP_Error( 'address_invalid' );
		}
		$host = strtolower( $parts['host'] );
		if ( 1 !== preg_match( self::HOST_PATTERN, $host ) ) {
			return new \WP_Error( 'address_invalid' );
		}
		if ( 'http' === $scheme && ! self::is_development_host( $host ) ) {
			return new \WP_Error( 'address_insecure' );
		}

		$origin = $scheme . '://' . $host;
		if ( isset( $parts['port'] ) ) {
			$port = (int) $parts['port'];
			if ( $port < 1 || $port > 65535 ) {
				return new \WP_Error( 'address_invalid' );
			}
			$default_port = ( 'https' === $scheme ) ? 443 : 80;
			if ( $port !== $default_port ) {
				$origin .= ':' . $port;
			}
		}
		return $origin;
	}

	/**
	 * Whether a host is one of the development hosts, the only ones where plain http is accepted.
	 *
	 * @param mixed $host A host name, lower-case.
	 * @return bool
	 */
	public static function is_development_host( $host ) {
		if ( ! is_string( $host ) ) {
			return false;
		}
		$host = strtolower( $host );
		return 'localhost' === $host
			|| '127.0.0.1' === $host
			|| '.test' === substr( $host, -5 )
			|| '.localhost' === substr( $host, -10 );
	}

	/**
	 * Cleans the optional organisation slug of the CasaZen domain.
	 *
	 * @param mixed $raw The slug as typed.
	 * @return string|false The slug (empty for none), or false when it is not valid.
	 */
	public static function normalise_slug( $raw ) {
		if ( ! is_string( $raw ) ) {
			return false;
		}
		$slug = strtolower( trim( $raw ) );
		if ( '' === $slug ) {
			return '';
		}
		if ( strlen( $slug ) > self::MAX_SLUG_LENGTH || 1 !== preg_match( self::SLUG_PATTERN, $slug ) ) {
			return false;
		}
		return $slug;
	}

	/**
	 * Reads the language mapping: one line per language, `<code> = it|en|auto`.
	 *
	 * Accepts the text of the form field or an array code => value (a value that was already cleaned).
	 *
	 * @param mixed $raw The textarea content or an array.
	 * @return array { map: array code => value, rejected: string[] the lines that were dropped }
	 */
	public static function parse_language_map( $raw ) {
		$entries  = array();
		$rejected = array();

		if ( is_array( $raw ) ) {
			foreach ( $raw as $code => $value ) {
				$entries[] = array( (string) $code, is_string( $value ) ? $value : '' );
			}
		} elseif ( is_string( $raw ) ) {
			$lines = preg_split( '/\r\n|\r|\n/', $raw );
			foreach ( (array) $lines as $line ) {
				$line = trim( (string) $line );
				if ( '' === $line ) {
					continue;
				}
				$position = strpos( $line, '=' );
				if ( false === $position ) {
					$rejected[] = $line;
					continue;
				}
				$entries[] = array( trim( substr( $line, 0, $position ) ), trim( substr( $line, $position + 1 ) ) );
			}
		}

		$map = array();
		foreach ( $entries as $entry ) {
			$code  = $entry[0];
			$value = strtolower( $entry[1] );
			if (
				1 !== preg_match( self::LANGUAGE_CODE_PATTERN, $code )
				|| ! in_array( $value, self::LANGUAGES, true )
				|| ( count( $map ) >= self::MAX_LANGUAGE_LINES && ! isset( $map[ $code ] ) )
			) {
				$rejected[] = $code . ' = ' . $entry[1];
				continue;
			}
			$map[ $code ] = $value;
		}

		return array(
			'map'      => $map,
			'rejected' => $rejected,
		);
	}

	/**
	 * The language mapping as the text of the form field, one `code = value` line each.
	 *
	 * @param mixed $map The stored mapping.
	 * @return string
	 */
	public static function language_map_to_text( $map ) {
		$lines = array();
		if ( is_array( $map ) ) {
			foreach ( $map as $code => $value ) {
				if ( is_string( $value ) ) {
					$lines[] = $code . ' = ' . $value;
				}
			}
		}
		return implode( "\n", $lines );
	}

	/**
	 * A new option, created by the first save when the activation did not create it: same rules as a change.
	 *
	 * @param string $option The option name.
	 * @param mixed  $value  The new value.
	 * @return void
	 */
	public static function on_add( $option, $value ) {
		unset( $option );
		self::on_update( self::defaults(), $value );
	}

	/**
	 * A change of the address or of the slug drops the cached connection result and runs one refresh.
	 *
	 * @param mixed $old_value The previous value of the option.
	 * @param mixed $value     The new value of the option.
	 * @return void
	 */
	public static function on_update( $old_value, $value ) {
		$old = self::coerce( $old_value );
		$new = self::coerce( $value );
		if ( $old['address'] === $new['address'] && $old['org_slug'] === $new['org_slug'] ) {
			return;
		}
		Connection::forget( $old['address'], $old['org_slug'] );
		Connection::forget( $new['address'], $new['org_slug'] );
		Connection::refresh();
	}

	/**
	 * The text shown when an address is refused. The code comes from normalise_address().
	 *
	 * @param string $code The error code.
	 * @return string
	 */
	public static function address_message( $code ) {
		switch ( $code ) {
			case 'address_scheme':
				return __( 'The CasaZen address must start with https://. The previous address was kept.', 'casazen' );
			case 'address_insecure':
				return __( 'Only https addresses are accepted (http works only for local development hosts). The previous address was kept.', 'casazen' );
			case 'address_credentials':
				return __( 'The CasaZen address must not contain a user name or a password. The previous address was kept.', 'casazen' );
			default:
				return __( 'The CasaZen address is not valid. Use the form https://prenota.example.com. The previous address was kept.', 'casazen' );
		}
	}

	/**
	 * Shows an error above the settings form. The Settings API functions only exist in the admin: elsewhere this does nothing.
	 *
	 * @param string $code    The error code.
	 * @param string $message The text, already safe to print as HTML.
	 * @return void
	 */
	private static function report( $code, $message ) {
		if ( function_exists( 'add_settings_error' ) ) {
			add_settings_error( self::OPTION, $code, $message, 'error' );
		}
	}
}
