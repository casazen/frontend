<?php
/**
 * The connection test: the ONLY place where PHP calls CasaZen.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Tests the connection to the address of the agency and caches the result.
 *
 * Two calls, both from the server of the site, never from a public page: the manifest
 * `<address>/embed/v1/manifest.json` and `GET <apiBase>/api/public/resolve-host?host=<host>` (or, on the CasaZen domain
 * with an organisation slug, `GET <apiBase>/api/public/orgs/<slug>`). Only the host name is sent. The result is a small
 * normalised array: no header, no cookie and no raw body is ever kept.
 */
class Connection {

	/**
	 * The result of a test is kept in a transient named with this prefix and 12 characters of a hash.
	 *
	 * @var string
	 */
	const CACHE_PREFIX = 'casazen_conn_';

	/**
	 * How long a result that is ok is kept (12 hours).
	 *
	 * @var int
	 */
	const SUCCESS_TTL = 12 * HOUR_IN_SECONDS;

	/**
	 * How long a failure is kept (15 minutes): an unreachable CasaZen is not retried on every request.
	 *
	 * @var int
	 */
	const FAILURE_TTL = 15 * MINUTE_IN_SECONDS;

	/**
	 * Seconds between the cache miss of a public page and the background refresh it schedules.
	 *
	 * @var int
	 */
	const SCHEDULE_DELAY = 10;

	/**
	 * Every code a result can carry. `embed_disabled` is a warning: the result stays ok.
	 *
	 * @var string[]
	 */
	const CODES = array(
		'not_configured',
		'manifest_unreachable',
		'manifest_invalid',
		'resolve_unreachable',
		'host_not_found',
		'embed_disabled',
		'ok',
	);

	/**
	 * Runs the connection test. It always makes the network calls: only the admin test button, the settings save and the
	 * background event call it.
	 *
	 * @param string $address The origin of the agency address (already normalised by Settings).
	 * @param string $slug    The organisation slug, only for the CasaZen domain (may be empty).
	 * @return array { ok, code, agency, slug, apiBase, embedEnabled (bool|null), surfaces (array|null), ownerLoginReady (bool|null), checkedAt }
	 */
	public static function test( $address, $slug ) {
		$address = is_string( $address ) ? $address : '';
		$slug    = is_string( $slug ) ? $slug : '';
		if ( '' === $address ) {
			return self::result( 'not_configured' );
		}

		$host = wp_parse_url( $address, PHP_URL_HOST );
		$host = is_string( $host ) ? strtolower( $host ) : '';

		// Only an address that is itself a development host may reach other development hosts.
		$development = Settings::is_development_host( $host );

		// (a) The manifest of the address (contract v1).
		$reply = self::get_json( $address . '/embed/v1/manifest.json', $development );
		if ( null === $reply || $reply['status'] >= 500 ) {
			return self::result( 'manifest_unreachable' );
		}
		$api_base = false;
		if ( 200 === $reply['status'] && is_array( $reply['data'] ) ) {
			$api_base = self::read_manifest( $reply['data'], $development );
		}
		if ( false === $api_base ) {
			return self::result( 'manifest_invalid' );
		}
		$known = array( 'apiBase' => $api_base );

		// (b) Which agency answers to this host.
		$reply = self::get_json( $api_base . '/api/public/resolve-host?host=' . rawurlencode( $host ), $development );
		if ( null === $reply ) {
			return self::result( 'resolve_unreachable', $known );
		}
		if ( 404 === $reply['status'] ) {
			if ( '' !== $slug ) {
				// (c) The address is the CasaZen domain, which is no agency host: ask for the organisation by its slug.
				return self::from_slug( $api_base, $slug, $development );
			}
			return self::result( 'host_not_found', $known );
		}
		if ( 200 !== $reply['status'] || ! is_array( $reply['data'] ) ) {
			return self::result( 'resolve_unreachable', $known );
		}
		$data   = $reply['data'];
		$agency = '';
		if ( isset( $data['branding'] ) && is_array( $data['branding'] ) && isset( $data['branding']['displayName'] ) ) {
			$agency = self::clean_text( $data['branding']['displayName'], 200 );
		}
		$found_slug = isset( $data['slug'] ) ? self::clean_slug( $data['slug'] ) : '';
		if ( '' === $agency || '' === $found_slug ) {
			return self::result( 'resolve_unreachable', $known );
		}

		$embed = self::bool_or_null( $data, 'embedEnabled' );
		return self::result(
			false === $embed ? 'embed_disabled' : 'ok',
			array(
				'agency'          => $agency,
				'slug'            => $found_slug,
				'apiBase'         => $api_base,
				'embedEnabled'    => $embed,
				'surfaces'        => self::read_surfaces( $data ),
				'ownerLoginReady' => self::bool_or_null( $data, 'ownerLoginReady' ),
			)
		);
	}

	/**
	 * Runs the test with the saved settings, keeps the result and tells the other parts of the plugin.
	 *
	 * Called by the settings save, by the admin test button and by the background event. Never by a public page load.
	 *
	 * @return array The result of the test.
	 */
	public static function refresh() {
		$settings = Settings::get();
		$result   = self::test( $settings['address'], $settings['org_slug'] );
		if ( '' !== $settings['address'] ) {
			set_transient(
				self::cache_key( $settings['address'], $settings['org_slug'] ),
				$result,
				$result['ok'] ? self::SUCCESS_TTL : self::FAILURE_TTL
			);
		}

		/**
		 * Fires after the connection was tested and its result stored.
		 *
		 * @param array $result The normalised result of the test.
		 */
		do_action( 'casazen_connection_refreshed', $result );

		return $result;
	}

	/**
	 * The last stored result for the saved settings. It only reads: it never calls CasaZen and never schedules anything.
	 *
	 * @return array|null The result; `not_configured` while no address is set; null when nothing is stored (a miss).
	 */
	public static function cached() {
		$settings = Settings::get();
		if ( '' === $settings['address'] ) {
			return self::result( 'not_configured' );
		}
		$value = get_transient( self::cache_key( $settings['address'], $settings['org_slug'] ) );
		return self::is_result( $value ) ? $value : null;
	}

	/**
	 * What a public page uses: the stored result, or null. A miss schedules ONE background refresh and the page renders
	 * with what it has: a public page load never calls CasaZen.
	 *
	 * @return array|null Same values as cached().
	 */
	public static function current() {
		$result = self::cached();
		if ( null === $result ) {
			self::schedule_refresh();
		}
		return $result;
	}

	/**
	 * Schedules one single event that will run refresh(), unless one is already waiting.
	 *
	 * @return void
	 */
	public static function schedule_refresh() {
		if ( ! wp_next_scheduled( Plugin::CRON_EVENT ) ) {
			wp_schedule_single_event( time() + self::SCHEDULE_DELAY, Plugin::CRON_EVENT );
		}
	}

	/**
	 * The name of the transient that holds the result for an address and a slug.
	 *
	 * @param string $address The origin of the agency address.
	 * @param string $slug    The organisation slug (may be empty).
	 * @return string
	 */
	public static function cache_key( $address, $slug ) {
		return self::CACHE_PREFIX . substr( md5( $address . '|' . $slug ), 0, 12 );
	}

	/**
	 * Drops the stored result for an address and a slug.
	 *
	 * @param string $address The origin of the agency address.
	 * @param string $slug    The organisation slug (may be empty).
	 * @return void
	 */
	public static function forget( $address, $slug ) {
		if ( is_string( $address ) && '' !== $address ) {
			delete_transient( self::cache_key( $address, is_string( $slug ) ? $slug : '' ) );
		}
	}

	/**
	 * The text for a result code, in the language of the admin. Built when it is printed, never before init.
	 *
	 * @param string $code One of the CODES.
	 * @return string
	 */
	public static function message( $code ) {
		switch ( $code ) {
			case 'ok':
				return __( 'The connection works.', 'casazen' );
			case 'embed_disabled':
				return __( 'The connection works, but embedding is not switched on for your agency yet. Ask your CasaZen contact to switch it on.', 'casazen' );
			case 'manifest_unreachable':
				return __( 'The address could not be reached. Check that it is correct and that the site is online.', 'casazen' );
			case 'manifest_invalid':
				return __( 'The address answered, but it is not a CasaZen address that supports embedding. Check the address.', 'casazen' );
			case 'resolve_unreachable':
				return __( 'CasaZen did not answer the check as expected. Try again in a few minutes.', 'casazen' );
			case 'host_not_found':
				return __( 'CasaZen does not know this address or this organisation slug. Check how they are written.', 'casazen' );
			default:
				return __( 'Set the CasaZen address to start.', 'casazen' );
		}
	}

	/**
	 * A normalised result. Nothing from the answers of CasaZen is kept except the few fields read below.
	 *
	 * @param string $code The result code.
	 * @param array  $data The fields to carry (agency, slug, apiBase, embedEnabled, surfaces, ownerLoginReady).
	 * @return array
	 */
	private static function result( $code, array $data = array() ) {
		return array(
			'ok'              => ( 'ok' === $code || 'embed_disabled' === $code ),
			'code'            => $code,
			'agency'          => isset( $data['agency'] ) ? (string) $data['agency'] : '',
			'slug'            => isset( $data['slug'] ) ? (string) $data['slug'] : '',
			'apiBase'         => isset( $data['apiBase'] ) ? (string) $data['apiBase'] : '',
			'embedEnabled'    => isset( $data['embedEnabled'] ) ? (bool) $data['embedEnabled'] : null,
			'surfaces'        => isset( $data['surfaces'] ) && is_array( $data['surfaces'] ) ? $data['surfaces'] : null,
			'ownerLoginReady' => isset( $data['ownerLoginReady'] ) ? (bool) $data['ownerLoginReady'] : null,
			'checkedAt'       => time(),
		);
	}

	/**
	 * Whether a stored value is a result written by this class.
	 *
	 * @param mixed $value The value of the transient.
	 * @return bool
	 */
	private static function is_result( $value ) {
		return is_array( $value )
			&& isset( $value['code'] )
			&& in_array( $value['code'], self::CODES, true )
			&& array_key_exists( 'ok', $value )
			&& isset( $value['checkedAt'] );
	}

	/**
	 * The fallback for the CasaZen domain: the organisation is asked by its slug.
	 *
	 * @param string $api_base    The API address read from the manifest.
	 * @param string $slug        The organisation slug of the settings.
	 * @param bool   $development Whether the agency address is a development host.
	 * @return array
	 */
	private static function from_slug( $api_base, $slug, $development ) {
		$known = array( 'apiBase' => $api_base );
		$reply = self::get_json( $api_base . '/api/public/orgs/' . rawurlencode( $slug ), $development );
		if ( null === $reply ) {
			return self::result( 'resolve_unreachable', $known );
		}
		if ( 404 === $reply['status'] ) {
			return self::result( 'host_not_found', $known );
		}
		if ( 200 !== $reply['status'] || ! is_array( $reply['data'] ) ) {
			return self::result( 'resolve_unreachable', $known );
		}
		$data   = $reply['data'];
		$agency = isset( $data['displayName'] ) ? self::clean_text( $data['displayName'], 200 ) : '';
		if ( '' === $agency ) {
			return self::result( 'resolve_unreachable', $known );
		}

		// A field the answer does not carry is unknown (null), never false.
		$embed = self::bool_or_null( $data, 'embedEnabled' );
		return self::result(
			false === $embed ? 'embed_disabled' : 'ok',
			array(
				'agency'       => $agency,
				'slug'         => $slug,
				'apiBase'      => $api_base,
				'embedEnabled' => $embed,
			)
		);
	}

	/**
	 * Checks a manifest of the contract v1 and returns its API address.
	 *
	 * Valid: `v` equal to 1, `widgets` an array and `apiBase` an https URL (http only when the agency address itself is a
	 * development host: a hostile manifest must not aim the server at its own http services).
	 *
	 * @param array $manifest          The decoded JSON.
	 * @param bool  $allow_development Whether an http API address on a development host is accepted.
	 * @return string|false The API address without a trailing slash, or false.
	 */
	private static function read_manifest( array $manifest, $allow_development ) {
		if ( ! isset( $manifest['v'] ) || 1 !== $manifest['v'] ) {
			return false;
		}
		if ( ! isset( $manifest['widgets'] ) || ! is_array( $manifest['widgets'] ) ) {
			return false;
		}
		if ( ! isset( $manifest['apiBase'] ) || ! is_string( $manifest['apiBase'] ) ) {
			return false;
		}

		$value = trim( $manifest['apiBase'] );
		if ( '' === $value || 1 === preg_match( '/[\x00-\x20\x7F]/', $value ) ) {
			return false;
		}
		$parts = wp_parse_url( $value );
		if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) || ! is_string( $parts['host'] ) ) {
			return false;
		}
		foreach ( array( 'user', 'pass', 'query', 'fragment' ) as $forbidden ) {
			if ( array_key_exists( $forbidden, $parts ) ) {
				return false;
			}
		}
		$scheme = strtolower( $parts['scheme'] );
		$host   = strtolower( $parts['host'] );
		if ( 1 !== preg_match( Settings::HOST_PATTERN, $host ) ) {
			return false;
		}
		$development = $allow_development && 'http' === $scheme && Settings::is_development_host( $host );
		if ( 'https' !== $scheme && ! $development ) {
			return false;
		}

		$base = $scheme . '://' . $host;
		if ( isset( $parts['port'] ) ) {
			$port = (int) $parts['port'];
			if ( $port < 1 || $port > 65535 ) {
				return false;
			}
			$base .= ':' . $port;
		}
		if ( isset( $parts['path'] ) && is_string( $parts['path'] ) ) {
			$base .= rtrim( $parts['path'], '/' );
		}
		return $base;
	}

	/**
	 * One GET, read as JSON. The headers, the cookies and the raw body are dropped here: only the status and the decoded
	 * object leave this function.
	 *
	 * @param string $url         The address to read.
	 * @param bool   $development Whether the agency address is a development host: only then may the plain request, which
	 *                            reaches loopback addresses and unusual ports, be used (and only for a development host).
	 * @return array|null { status: int, data: array|null }, or null when the request failed (no answer, refused address).
	 */
	private static function get_json( $url, $development ) {
		$args = array(
			'timeout'             => 5,
			'redirection'         => 2,
			'limit_response_size' => 65536,
			'sslverify'           => true,
			'user-agent'          => 'CasaZen-WordPress/' . CASAZEN_VERSION,
			'headers'             => array( 'Accept' => 'application/json' ),
		);

		// The safe variant refuses loopback addresses and unusual ports by design: development hosts need the plain one.
		$host = wp_parse_url( $url, PHP_URL_HOST );
		if ( $development && is_string( $host ) && Settings::is_development_host( $host ) ) {
			$response = wp_remote_get( $url, $args );
		} else {
			$response = wp_safe_remote_get( $url, $args );
		}
		if ( is_wp_error( $response ) ) {
			return null;
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$data   = null;
		if ( 200 === $status ) {
			$decoded = json_decode( (string) wp_remote_retrieve_body( $response ), true, 16 );
			if ( is_array( $decoded ) ) {
				$data = $decoded;
			}
		}
		return array(
			'status' => $status,
			'data'   => $data,
		);
	}

	/**
	 * The surfaces of the agency, when the answer carries them.
	 *
	 * @param array $data The decoded `resolve-host` answer.
	 * @return array|null { guestArea: bool|null, ownerPortal: bool|null }, or null when the answer has no `surfaces`.
	 */
	private static function read_surfaces( array $data ) {
		if ( ! isset( $data['surfaces'] ) || ! is_array( $data['surfaces'] ) ) {
			return null;
		}
		return array(
			'guestArea'   => self::bool_or_null( $data['surfaces'], 'guestArea' ),
			'ownerPortal' => self::bool_or_null( $data['surfaces'], 'ownerPortal' ),
		);
	}

	/**
	 * A boolean field of an answer; anything that is not a JSON boolean means unknown.
	 *
	 * @param array  $data The decoded answer.
	 * @param string $key  The field name.
	 * @return bool|null
	 */
	private static function bool_or_null( array $data, $key ) {
		return ( isset( $data[ $key ] ) && is_bool( $data[ $key ] ) ) ? $data[ $key ] : null;
	}

	/**
	 * A text of an answer, safe to keep: tags removed, trimmed and cut.
	 *
	 * @param mixed $value  The value read from the answer.
	 * @param int   $length The longest accepted length.
	 * @return string
	 */
	private static function clean_text( $value, $length ) {
		if ( ! is_string( $value ) ) {
			return '';
		}
		return mb_substr( trim( wp_strip_all_tags( $value ) ), 0, $length );
	}

	/**
	 * A slug of an answer: letters, digits, hyphens and underscores only.
	 *
	 * @param mixed $value The value read from the answer.
	 * @return string
	 */
	private static function clean_slug( $value ) {
		if ( ! is_string( $value ) ) {
			return '';
		}
		return substr( (string) preg_replace( '/[^A-Za-z0-9_-]/', '', $value ), 0, Settings::MAX_SLUG_LENGTH );
	}
}
