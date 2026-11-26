<?php
/**
 * Plugin Name: CasaZen smoke test, canned HTTP answers
 * Description: For the smoke test only (tests/smoke/smoke.sh). It answers the requests that the CasaZen plugin makes with canned JSON and refuses every other outbound request, so the test needs no network and no real CasaZen address.
 * Version:     1.0.0
 *
 * @package Casazen
 */

defined( 'ABSPATH' ) || exit;

/**
 * The agency of the smoke test: an address that does not exist, and the API its manifest names.
 *
 * `https://prenota.example.com` is the address that smoke.sh writes in the settings; `https://api.example.com/api` is what the
 * manifest says the API is, the way the real manifest names the API of CasaZen.
 *
 * @param string $url The address the plugin asks for.
 * @return array|null The JSON that CasaZen would answer with status 200, or null when the smoke test knows no answer for it.
 */
function casazen_smoke_canned( $url ) {
	$parts = wp_parse_url( $url );
	if ( ! is_array( $parts ) || empty( $parts['host'] ) || empty( $parts['path'] ) ) {
		return null;
	}
	$host  = $parts['host'];
	$path  = $parts['path'];
	$query = isset( $parts['query'] ) ? $parts['query'] : '';

	// The manifest of the contract v1: the plugin reads where the API is.
	if ( 'prenota.example.com' === $host && '/embed/v1/manifest.json' === $path ) {
		return array(
			'v'       => 1,
			'apiBase' => 'https://api.example.com/api',
			'widgets' => array( 'booking', 'property', 'guest-access', 'search' ),
			'loader'  => 'https://prenota.example.com/embed/v1/embed.js',
			'search'  => 'https://prenota.example.com/embed/v1/search.js',
		);
	}

	// Which agency answers at this host: its name, and what is switched on for it.
	if ( 'api.example.com' === $host && '/api/public/resolve-host' === $path && 'host=prenota.example.com' === $query ) {
		return array(
			'orgId'           => 'b7c1',
			'slug'            => 'agenzia-esempio',
			'publicHostMode'  => 'custom',
			'planTier'        => 'pro',
			'branding'        => array(
				'displayName' => 'Agenzia Esempio',
				'slug'        => 'agenzia-esempio',
			),
			'embedEnabled'    => true,
			'surfaces'        => array(
				'guestArea'   => true,
				'ownerPortal' => true,
			),
			'ownerLoginReady' => true,
		);
	}

	// The places of the search bar.
	if ( 'api.example.com' === $host && '/api/public/orgs/agenzia-esempio/destinations' === $path ) {
		return array(
			array(
				'id'    => 'lugano',
				'label' => 'Lugano',
			),
			array(
				'id'    => 'locarno',
				'label' => 'Locarno',
			),
		);
	}

	return null;
}

/**
 * Answers a request instead of sending it.
 *
 * A request the mock knows gets its canned answer. Any other request gets an error, so nothing leaves the machine: WordPress copes
 * with it (an update check just fails). A request that the CasaZen plugin made (its user agent says so) and that has no canned
 * answer is a bug of the plugin or of this mock: it is written in the log, where smoke.sh looks for it.
 *
 * @param false|array|WP_Error $preempt What an earlier filter decided.
 * @param array                $args    The request arguments.
 * @param string               $url     The address.
 * @return array|WP_Error
 */
function casazen_smoke_pre_http_request( $preempt, $args, $url ) {
	if ( false !== $preempt ) {
		return $preempt;
	}

	$canned = casazen_smoke_canned( $url );
	if ( null !== $canned ) {
		return array(
			'headers'  => array( 'content-type' => 'application/json' ),
			'body'     => wp_json_encode( $canned ),
			'response' => array(
				'code'    => 200,
				'message' => 'OK',
			),
			'cookies'  => array(),
			'filename' => null,
		);
	}

	$agent = ( is_array( $args ) && isset( $args['user-agent'] ) ) ? (string) $args['user-agent'] : '';
	if ( 0 === strpos( $agent, 'CasaZen-WordPress/' ) ) {
		error_log( 'casazen-smoke-unexpected-request ' . $url ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- the smoke test reads this line from the log.
	}
	return new WP_Error( 'casazen_smoke_no_network', 'The smoke test of the CasaZen plugin has no network.' );
}

add_filter( 'pre_http_request', 'casazen_smoke_pre_http_request', 10, 3 );
