<?php
/**
 * Plugin Name: CasaZen smoke test, canned HTTP answers
 * Description: For the smoke test only (tests/smoke/smoke.sh). It answers the requests that the CasaZen plugin makes with canned JSON (and, for a connected site, with a small copy of the API of CasaZen) and refuses every other outbound request, so the test needs no network and no real CasaZen address.
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

	// The CasaZen console of the smoke test (the constant CASAZEN_APP_ORIGIN of .wp-env.json) serves the manifest too: «Connect to
	// CasaZen» reads where the API is from it, and so does the connection test while the agency is on the CasaZen address.
	if ( 'app.example.com' === $host && '/embed/v1/manifest.json' === $path ) {
		return array(
			'v'       => 1,
			'apiBase' => 'https://api.example.com/api',
			'widgets' => array( 'booking', 'property', 'guest-access', 'search' ),
			'loader'  => 'https://app.example.com/embed/v1/embed.js',
			'search'  => 'https://app.example.com/embed/v1/search.js',
		);
	}

	// The agency on the CasaZen address: the connection test asks for it by its slug.
	if ( 'api.example.com' === $host && '/api/public/orgs/agenzia-esempio' === $path ) {
		return array(
			'slug'         => 'agenzia-esempio',
			'displayName'  => 'Agenzia Esempio',
			'embedEnabled' => true,
		);
	}

	return null;
}

/**
 * The credential that the mock gives to the site. smoke.sh checks that no page of the administrator ever prints it.
 *
 * @return string
 */
function casazen_smoke_site_token() {
	return 'czs_SmokeCredentialMustNeverBePrinted0123456789ab';
}

/**
 * What the mock remembers of the agency between two requests: its domain, whether it is verified and the three choices.
 *
 * @return array
 */
function casazen_smoke_site_state() {
	$state = get_option( 'smoke_mock_site_api', array() );
	return array_merge(
		array(
			'domain'   => '',
			'verified' => false,
			'surfaces' => array( false, false, false ),
		),
		is_array( $state ) ? $state : array()
	);
}

/**
 * The account of the agency, as `GET /api/site/v1/account` answers it, for the remembered state.
 *
 * @param array $state The state of casazen_smoke_site_state().
 * @return array
 */
function casazen_smoke_site_account( array $state ) {
	$domain   = $state['domain'];
	$verified = '' !== $domain && $state['verified'];
	$org_id   = '6f1c2b9e-0d4a-4c51-9a77-1f2e3d4c5b6a';
	return array(
		'connectionId'      => '0b8e7c6d-5a4f-4e3d-8c2b-1a0f9e8d7c6b',
		'org'               => array(
			'id'          => $org_id,
			'slug'        => 'agenzia-esempio',
			'displayName' => 'Agenzia Esempio',
		),
		'embedEnabled'      => true,
		'publicAddress'     => $verified ? 'https://' . $domain : 'https://app.example.com',
		'publicAddressKind' => $verified ? 'customDomain' : 'casazen',
		'domain'            => array(
			'orgId'                    => $org_id,
			'publicHostMode'           => '' === $domain ? 'CasazenPath' : 'CustomDomain',
			'customDomain'             => '' === $domain ? null : $domain,
			'domainVerificationStatus' => $verified ? 'Verified' : 'Pending',
			'canUseCustomDomain'       => true,
			'dnsInstructions'          => '' === $domain ? null : array(
				'cnameHost'      => $domain,
				'cnameTarget'    => 'cname.smoke-dns.example.net',
				'txtHost'        => '_casazen-verify.' . $domain,
				'txtValue'       => 'casazen-verify=smoke-txt-value',
				'sslNote'        => '',
				'aRecordValues'  => array( '192.0.2.10' ),
				'vercelTxtHost'  => null,
				'vercelTxtValue' => null,
			),
			'publicUrls'               => array(
				'pathUrl'         => 'https://app.example.com/s/agenzia-esempio',
				'subdomainUrl'    => null,
				'customDomainUrl' => $verified ? 'https://' . $domain : null,
			),
			'status'                   => array(
				'detail'              => ( '' === $domain || $verified ) ? null : 'ownership_txt_missing',
				'message'             => null,
				'checkedAt'           => gmdate( 'Y-m-d\TH:i:s\Z' ),
				'verifiedAt'          => $verified ? gmdate( 'Y-m-d\TH:i:s\Z' ) : null,
				'activationAvailable' => true,
				'autoCheckActive'     => '' !== $domain && ! $verified,
			),
			'surfaces'                 => array(
				'guestAreaOnOwnDomain'   => (bool) $state['surfaces'][0],
				'ownerPortalOnOwnDomain' => (bool) $state['surfaces'][1],
				'useOwnDomainForLinks'   => (bool) $state['surfaces'][2],
				'ownerLoginHostState'    => $state['surfaces'][1] ? 'Pending' : 'NotRequested',
				'ownerLoginAutomatic'    => false,
				'effective'              => array(
					'guestArea'        => $verified && $state['surfaces'][0],
					'ownerPortal'      => $verified && $state['surfaces'][1],
					'ownerLoginReady'  => false,
					'linksOnOwnDomain' => $verified && $state['surfaces'][2],
				),
			),
			'tracking'                 => null,
		),
	);
}

/**
 * The API of a connected site (`/api/public/site-connections/token` and `/api/site/v1/*`), a small copy of what CasaZen does: the
 * exchange of the code gives the credential above, every call of the site needs it as a Bearer header, the domain can be saved,
 * checked (the check verifies it at once) and removed, and the disconnection answers 204.
 *
 * @param string $url  The address the plugin asks for.
 * @param array  $args The request arguments.
 * @return array|null { status: int, body: array|null }, or null when the address is not one of this API.
 */
function casazen_smoke_site_api( $url, $args ) {
	$parts = wp_parse_url( $url );
	if ( ! is_array( $parts ) || ! isset( $parts['host'], $parts['path'] ) || 'api.example.com' !== $parts['host'] ) {
		return null;
	}
	$path    = $parts['path'];
	$method  = isset( $args['method'] ) ? strtoupper( (string) $args['method'] ) : 'GET';
	$headers = ( isset( $args['headers'] ) && is_array( $args['headers'] ) ) ? $args['headers'] : array();
	$body    = isset( $args['body'] ) && is_string( $args['body'] ) ? json_decode( $args['body'], true ) : null;

	if ( '/api/public/site-connections/token' === $path ) {
		$good = 'POST' === $method && is_array( $body )
			&& isset( $body['code'], $body['codeVerifier'], $body['siteUrl'] )
			&& 1 === preg_match( '/^[A-Za-z0-9_-]{16,}$/', (string) $body['code'] )
			&& 1 === preg_match( '/^[A-Za-z0-9._~-]{43,128}$/', (string) $body['codeVerifier'] )
			&& empty( $headers['Authorization'] );
		if ( ! $good ) {
			return array(
				'status' => 400,
				'body'   => array( 'code' => 'site_connection_invalid_grant' ),
			);
		}
		delete_option( 'smoke_mock_site_api' );
		$account = casazen_smoke_site_account( casazen_smoke_site_state() );
		return array(
			'status' => 200,
			'body'   => array(
				'accessToken'  => casazen_smoke_site_token(),
				'connectionId' => $account['connectionId'],
				'org'          => $account['org'],
			),
		);
	}

	if ( 0 !== strpos( $path, '/api/site/v1/' ) ) {
		return null;
	}
	if ( ! isset( $headers['Authorization'] ) || 'Bearer ' . casazen_smoke_site_token() !== $headers['Authorization'] ) {
		return array(
			'status' => 401,
			'body'   => null,
		);
	}

	$state = casazen_smoke_site_state();
	if ( 'GET' === $method && '/api/site/v1/account' === $path ) {
		return array(
			'status' => 200,
			'body'   => casazen_smoke_site_account( $state ),
		);
	}
	if ( 'PUT' === $method && '/api/site/v1/domain' === $path && is_array( $body ) && array_key_exists( 'customDomain', $body ) ) {
		$state['domain']   = is_string( $body['customDomain'] ) ? strtolower( $body['customDomain'] ) : '';
		$state['verified'] = false;
		update_option( 'smoke_mock_site_api', $state, false );
		return array(
			'status' => 200,
			'body'   => casazen_smoke_site_account( $state ),
		);
	}
	if ( 'POST' === $method && '/api/site/v1/domain/verify' === $path && '' !== $state['domain'] ) {
		$state['verified'] = true;
		update_option( 'smoke_mock_site_api', $state, false );
		return array(
			'status' => 200,
			'body'   => array(
				'verify'  => array(
					'domainVerificationStatus' => 'Verified',
					'customDomain'             => $state['domain'],
					'checkedAt'                => gmdate( 'Y-m-d\TH:i:s\Z' ),
				),
				'account' => casazen_smoke_site_account( $state ),
			),
		);
	}
	if ( 'PUT' === $method && '/api/site/v1/domain/surfaces' === $path && is_array( $body ) ) {
		$state['surfaces'] = array( ! empty( $body['guestAreaOnOwnDomain'] ), ! empty( $body['ownerPortalOnOwnDomain'] ), ! empty( $body['useOwnDomainForLinks'] ) );
		update_option( 'smoke_mock_site_api', $state, false );
		return array(
			'status' => 200,
			'body'   => casazen_smoke_site_account( $state ),
		);
	}
	if ( 'DELETE' === $method && '/api/site/v1/connection' === $path ) {
		return array(
			'status' => 204,
			'body'   => null,
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

	$answer = casazen_smoke_site_api( $url, is_array( $args ) ? $args : array() );
	if ( null === $answer && false !== strpos( $url, '/api/public/resolve-host?host=app.example.com' ) ) {
		// The address of CasaZen is no host of an agency: the connection test then asks for the agency by its slug.
		$answer = array(
			'status' => 404,
			'body'   => array( 'code' => 'not_found' ),
		);
	}
	if ( null === $answer ) {
		$canned = casazen_smoke_canned( $url );
		if ( null !== $canned ) {
			$answer = array(
				'status' => 200,
				'body'   => $canned,
			);
		}
	}
	if ( null !== $answer ) {
		return array(
			'headers'  => array( 'content-type' => 'application/json' ),
			'body'     => null === $answer['body'] ? '' : wp_json_encode( $answer['body'] ),
			'response' => array(
				'code'    => $answer['status'],
				'message' => 'Smoke',
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

/**
 * The state "checked a moment ago, nothing to update" of the three update checks of WordPress (core, plugins and themes).
 *
 * Every page of the admin asks api.wordpress.org, at most every 12 hours, whether there is an update, and when the answer is an
 * error WordPress itself writes a PHP warning in the debug log ("Something may be wrong with WordPress.org"). There is no network
 * here and the updates are not what the smoke test is about, so WordPress is given the answer ready and does not ask. Only these
 * three values are answered: the requests of the plugin go on to the canned answers above, and the check of the log is as strict as
 * ever.
 *
 * @param false|object $pre What an earlier filter decided.
 * @return object
 */
function casazen_smoke_updates_none( $pre ) {
	if ( false !== $pre ) {
		return $pre;
	}

	$state = array(
		'last_checked' => time(),
		'translations' => array(),
	);

	if ( 'pre_site_transient_update_core' === current_filter() ) {
		$state['updates']         = array();
		$state['version_checked'] = $GLOBALS['wp_version'];
		return (object) $state;
	}

	// Plugins and themes: nothing to update, nothing to list.
	$state['checked']   = array();
	$state['response']  = array();
	$state['no_update'] = array();
	return (object) $state;
}

add_filter( 'pre_site_transient_update_core', 'casazen_smoke_updates_none' );
add_filter( 'pre_site_transient_update_plugins', 'casazen_smoke_updates_none' );
add_filter( 'pre_site_transient_update_themes', 'casazen_smoke_updates_none' );
