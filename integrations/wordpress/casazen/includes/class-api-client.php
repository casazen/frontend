<?php
/**
 * The client of the API that a connected site uses: the exchange of the code and the account and domain of the agency.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Calls the CasaZen API from the server, for the screens of the administrator only (never for a public page):
 *
 * - `POST /api/public/site-connections/token` (anonymous: the code, the verifier and the origin of the site in the body);
 * - `/api/site/v1/*` with `Authorization: Bearer <credential of the site>`.
 *
 * Every request: https (http only for a development host on a development site, see Connection::allows_development_hosts()), the
 * safe request of WordPress, a timeout of 10 seconds, no redirect (a credential never follows a redirect to another host), a bounded
 * answer read as JSON. Nothing of a request or of an answer is logged, and the credential is never part of what a method returns:
 * a failure is a short code, which message() turns into a sentence for the administrator.
 */
class Api_Client {

	/**
	 * Seconds a request may take.
	 *
	 * @var int
	 */
	const TIMEOUT = 10;

	/**
	 * The largest answer that is read (bytes). A longer one is not an answer of this API.
	 *
	 * @var int
	 */
	const MAX_BYTES = 131072;

	/**
	 * The codes of a failure, each with its message.
	 *
	 * @var string[]
	 */
	const CODES = array(
		'unauthorized',
		'plan_required',
		'module_required',
		'onboarding_required',
		'forbidden',
		'not_found',
		'rate_limited',
		'unreachable',
		'invalid_grant',
		'domain_invalid',
		'domain_in_use',
		'domain_not_configured',
		'unexpected',
	);

	/**
	 * Sends one request to the API.
	 *
	 * @param string     $api_base The address of the API, as the manifest of the console names it (`https://host/api` or `https://host`).
	 * @param string     $method   `GET`, `POST`, `PUT` or `DELETE`.
	 * @param string     $path     The endpoint below `/api`, starting with a slash (`/site/v1/account`).
	 * @param string     $token    The credential of the site, or an empty string for the anonymous exchange.
	 * @param array|null $body     The JSON body, or null for none.
	 * @return array { ok: bool, status: int, data: array|null, error: string } `error` is one of the CODES when `ok` is false.
	 */
	public static function request( $api_base, $method, $path, $token = '', $body = null ) {
		$url = self::url( $api_base, $path );
		if ( '' === $url ) {
			return self::failure( 'unexpected', 0, null );
		}

		$headers = array(
			'Accept'          => 'application/json',
			'Accept-Language' => self::language(),
		);
		if ( is_string( $token ) && '' !== $token ) {
			$headers['Authorization'] = 'Bearer ' . $token;
		}
		$args = array(
			'method'              => $method,
			'timeout'             => self::TIMEOUT,
			'redirection'         => 0,
			'limit_response_size' => self::MAX_BYTES,
			'sslverify'           => true,
			'user-agent'          => 'CasaZen-WordPress/' . CASAZEN_VERSION,
			'headers'             => $headers,
		);
		if ( null !== $body ) {
			$args['headers']['Content-Type'] = 'application/json';
			$args['body']                    = wp_json_encode( $body );
		}

		// The safe request refuses loopback addresses and unusual ports: a development host on a development site needs the plain one.
		$host = wp_parse_url( $url, PHP_URL_HOST );
		if ( is_string( $host ) && Settings::is_development_host( $host ) && Connection::allows_development_hosts() ) {
			$response = wp_remote_request( $url, $args );
		} else {
			$response = wp_safe_remote_request( $url, $args );
		}
		if ( is_wp_error( $response ) ) {
			return self::failure( 'unreachable', 0, null );
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$raw    = (string) wp_remote_retrieve_body( $response );
		$data   = null;
		if ( '' !== $raw && strlen( $raw ) < self::MAX_BYTES ) {
			$decoded = json_decode( $raw, true, 16 );
			if ( is_array( $decoded ) ) {
				$data = $decoded;
			}
		}

		if ( $status >= 200 && $status < 300 ) {
			return array(
				'ok'     => true,
				'status' => $status,
				'data'   => $data,
				'error'  => '',
			);
		}
		return self::failure( self::error_code( $status, $data ), $status, $data );
	}

	/**
	 * The address of an endpoint, or an empty string when the address of the API is not one the plugin may call.
	 *
	 * @param string $api_base The address of the API.
	 * @param string $path     The endpoint below `/api`.
	 * @return string
	 */
	public static function url( $api_base, $path ) {
		if ( ! is_string( $api_base ) || '' === $api_base ) {
			return '';
		}
		$parts = wp_parse_url( $api_base );
		if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) || ! is_string( $parts['host'] ) ) {
			return '';
		}
		foreach ( array( 'user', 'pass', 'query', 'fragment' ) as $forbidden ) {
			if ( array_key_exists( $forbidden, $parts ) ) {
				return '';
			}
		}
		$scheme = strtolower( $parts['scheme'] );
		$host   = strtolower( $parts['host'] );
		if ( 'https' !== $scheme && ! ( 'http' === $scheme && Settings::is_development_host( $host ) && Connection::allows_development_hosts() ) ) {
			return '';
		}
		return Connection::api_url( $api_base, $path );
	}

	/**
	 * The code of a failure, from the status and the `code` of the answer.
	 *
	 * @param int        $status The HTTP status.
	 * @param array|null $data   The decoded answer.
	 * @return string One of the CODES.
	 */
	public static function error_code( $status, $data ) {
		$code = ( is_array( $data ) && isset( $data['code'] ) && is_string( $data['code'] ) ) ? $data['code'] : '';
		switch ( (int) $status ) {
			case 400:
				if ( 'site_connection_invalid_grant' === $code ) {
					return 'invalid_grant';
				}
				if ( 'org_domain_invalid' === $code ) {
					return 'domain_invalid';
				}
				if ( 'org_domain_not_configured' === $code ) {
					return 'domain_not_configured';
				}
				return 'unexpected';
			case 401:
				return 'unauthorized';
			case 403:
				if ( 'plan_required' === $code ) {
					return 'plan_required';
				}
				if ( 'commercial_module_required' === $code ) {
					return 'module_required';
				}
				if ( 'onboarding_required' === $code ) {
					return 'onboarding_required';
				}
				return 'forbidden';
			case 404:
				return 'not_found';
			case 409:
				return 'org_domain_in_use' === $code ? 'domain_in_use' : 'unexpected';
			case 429:
				return 'rate_limited';
		}
		return $status >= 500 ? 'unreachable' : 'unexpected';
	}

	/**
	 * The sentence for a failure, in the language of the administrator. Built when it is shown, never before init.
	 *
	 * @param string $code One of the CODES.
	 * @return string
	 */
	public static function message( $code ) {
		switch ( $code ) {
			case 'unauthorized':
				return __( 'No longer connected: CasaZen does not accept this site any more. Connect it again; your settings were kept.', 'casazen' );
			case 'plan_required':
				return __( 'Your own domain needs the Pro plan.', 'casazen' );
			case 'module_required':
				return __( 'Your CasaZen subscription does not include the booking site: switch it on in the CasaZen console.', 'casazen' );
			case 'onboarding_required':
				return __( 'Finish setting up your account in the CasaZen console first.', 'casazen' );
			case 'forbidden':
				return __( 'CasaZen does not allow this for your account.', 'casazen' );
			case 'not_found':
				return __( 'This CasaZen address does not offer the connection of the plugin, or embedding is not switched on for your agency. Use the manual set-up under Advanced.', 'casazen' );
			case 'rate_limited':
				return __( 'Too many requests to CasaZen in a short time. Try again in a few minutes.', 'casazen' );
			case 'unreachable':
				return __( 'CasaZen could not be reached. Try again in a few minutes.', 'casazen' );
			case 'invalid_grant':
				return __( 'The connection was not completed: the request expired or was already used. Press Connect to CasaZen again.', 'casazen' );
			case 'domain_invalid':
				return __( 'The domain is not valid. Write it like prenota.example.com.', 'casazen' );
			case 'domain_in_use':
				return __( 'This domain is already in use by another CasaZen site.', 'casazen' );
			case 'domain_not_configured':
				return __( 'Connect a domain first.', 'casazen' );
			default:
				return __( 'CasaZen gave an answer the plugin does not understand. Try again in a few minutes.', 'casazen' );
		}
	}

	/**
	 * The explanation that CasaZen gave with a refused request (`detail`), safe to show: tags removed, trimmed and cut.
	 *
	 * @param array|null $data The decoded answer.
	 * @return string
	 */
	public static function detail( $data ) {
		if ( ! is_array( $data ) || ! isset( $data['detail'] ) || ! is_string( $data['detail'] ) ) {
			return '';
		}
		return mb_substr( trim( wp_strip_all_tags( $data['detail'] ) ), 0, 300 );
	}

	/**
	 * The language CasaZen answers in (the explanations of the state of a domain): Italian for an Italian administrator, else English.
	 *
	 * @return string `it` or `en`.
	 */
	public static function language() {
		$locale = function_exists( 'determine_locale' ) ? determine_locale() : get_locale();
		return 0 === strpos( (string) $locale, 'it' ) ? 'it' : 'en';
	}

	/**
	 * A failed result.
	 *
	 * @param string     $code   One of the CODES.
	 * @param int        $status The HTTP status (0 without an answer).
	 * @param array|null $data   The decoded answer (it never holds the credential: CasaZen does not send it back).
	 * @return array
	 */
	private static function failure( $code, $status, $data ) {
		return array(
			'ok'     => false,
			'status' => (int) $status,
			'data'   => $data,
			'error'  => $code,
		);
	}
}
