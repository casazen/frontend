<?php
/**
 * What the tests of a connected site share: a stub of the API of CasaZen, an account to answer with, and the helpers that catch a
 * redirect or a refusal.
 *
 * Loaded by the test files that need it (it is not a test file: its name does not start with `test-`).
 *
 * @package Casazen
 */

use Casazen\Account;
use Casazen\Admin;
use Casazen\Build_Config;
use Casazen\Connect;
use Casazen\Destinations;
use Casazen\Link;
use Casazen\Settings;

// phpcs:disable Generic.Files.OneObjectStructurePerFile.MultipleFound -- the exception is a helper of the trait of this file alone.

/**
 * The credential that the stub gives: no screen, script, notice or answer may ever hold it.
 */
const CASAZEN_TEST_TOKEN = 'czs_TestCredentialThatMustNeverBePrinted0123456789';

/**
 * The organisation of the tests.
 */
const CASAZEN_TEST_ORG = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

/**
 * The connection of the tests.
 */
const CASAZEN_TEST_CONNECTION = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

/**
 * The address of the API that the stub names in its manifest.
 */
const CASAZEN_TEST_API = 'https://api.example.com/api';

/**
 * Thrown by the `wp_redirect` filter of the tests, so that a handler does not reach its `exit`.
 */
class Casazen_Test_Redirected extends Exception {
}

/**
 * The stub of the API and the helpers. A test class that uses it calls start_stub() in its set_up().
 */
trait Casazen_Api_Stub {

	/**
	 * The requests the stub saw, in order: { url, path, method, headers, body (decoded JSON), args }.
	 *
	 * @var array[]
	 */
	protected $calls = array();

	/**
	 * What the stub answers: the newest route of a method and a path wins.
	 *
	 * @var array[]
	 */
	protected $routes = array();

	/**
	 * Installs the stub. The places of the search bar have their own tests: the refresh of the connection does not read them here.
	 *
	 * @return void
	 */
	protected function start_stub() {
		$this->calls  = array();
		$this->routes = array();
		add_filter( 'pre_http_request', array( $this, 'answer_http' ), 10, 3 );
		remove_action( 'casazen_connection_refreshed', array( Destinations::class, 'on_connection_refreshed' ) );
	}

	/**
	 * The stub: records the request and answers with the route of its method and path, or with an error.
	 *
	 * @param false|array|WP_Error $preempt The value so far.
	 * @param array                $args    The request arguments.
	 * @param string               $url     The address.
	 * @return array|WP_Error
	 */
	public function answer_http( $preempt, $args, $url ) {
		unset( $preempt );
		$method = isset( $args['method'] ) ? strtoupper( (string) $args['method'] ) : 'GET';
		$path   = (string) wp_parse_url( $url, PHP_URL_PATH );

		$this->calls[] = array(
			'url'     => $url,
			'path'    => $path,
			'method'  => $method,
			'headers' => isset( $args['headers'] ) && is_array( $args['headers'] ) ? $args['headers'] : array(),
			'body'    => isset( $args['body'] ) && is_string( $args['body'] ) ? json_decode( $args['body'], true ) : null,
			'args'    => $args,
		);

		foreach ( $this->routes as $route ) {
			if ( $route['method'] !== $method || $route['path'] !== $path ) {
				continue;
			}
			if ( $route['error'] ) {
				return new WP_Error( 'http_request_failed', 'The stub refused ' . $path );
			}
			return array(
				'headers'  => array(),
				'cookies'  => array(),
				'filename' => null,
				'response' => array(
					'code'    => $route['status'],
					'message' => 'x',
				),
				'body'     => null === $route['body'] ? '' : wp_json_encode( $route['body'] ),
			);
		}
		return new WP_Error( 'http_request_failed', 'No reply was prepared for ' . $path );
	}

	/**
	 * Prepares the answer of a method and a path (it replaces an earlier one of the same method and path).
	 *
	 * @param string $method The HTTP method.
	 * @param string $path   The path of the address (`/api/site/v1/account`).
	 * @param int    $status The HTTP status.
	 * @param mixed  $body   What the JSON body holds, or null for none.
	 * @return void
	 */
	protected function route( $method, $path, $status, $body = null ) {
		array_unshift(
			$this->routes,
			array(
				'method' => $method,
				'path'   => $path,
				'status' => $status,
				'body'   => $body,
				'error'  => false,
			)
		);
	}

	/**
	 * Makes a method and a path fail as an unreachable host does.
	 *
	 * @param string $method The HTTP method.
	 * @param string $path   The path of the address.
	 * @return void
	 */
	protected function route_error( $method, $path ) {
		array_unshift(
			$this->routes,
			array(
				'method' => $method,
				'path'   => $path,
				'status' => 0,
				'body'   => null,
				'error'  => true,
			)
		);
	}

	/**
	 * The requests of a path (and a method).
	 *
	 * @param string $path   The path of the address.
	 * @param string $method The HTTP method, or an empty string for any.
	 * @return array[]
	 */
	protected function calls_to( $path, $method = '' ) {
		$found = array();
		foreach ( $this->calls as $call ) {
			if ( $call['path'] === $path && ( '' === $method || $call['method'] === $method ) ) {
				$found[] = $call;
			}
		}
		return $found;
	}

	/**
	 * The manifest of the console and of an agency address.
	 *
	 * @return array
	 */
	protected function manifest() {
		return array(
			'v'       => 1,
			'apiBase' => CASAZEN_TEST_API,
			'widgets' => array( 'booking', 'property', 'guest-access', 'search' ),
		);
	}

	/**
	 * The answer of the exchange of the code.
	 *
	 * @return array
	 */
	protected function grant() {
		return array(
			'accessToken'  => CASAZEN_TEST_TOKEN,
			'connectionId' => CASAZEN_TEST_CONNECTION,
			'org'          => array(
				'id'          => CASAZEN_TEST_ORG,
				'slug'        => 'agenzia-esempio',
				'displayName' => 'Agenzia Esempio',
			),
		);
	}

	/**
	 * An account as `GET /api/site/v1/account` answers it.
	 *
	 * @param string $domain   The domain of the agency, or an empty string for none.
	 * @param string $state    `Pending`, `Verified` or `Failed`.
	 * @param array  $override Members of the account to change (`domain` members go in `domain`).
	 * @return array
	 */
	protected function account( $domain = '', $state = 'Pending', array $override = array() ) {
		$verified = '' !== $domain && 'Verified' === $state;
		$account  = array(
			'connectionId'      => CASAZEN_TEST_CONNECTION,
			'org'               => array(
				'id'          => CASAZEN_TEST_ORG,
				'slug'        => 'agenzia-esempio',
				'displayName' => 'Agenzia Esempio',
			),
			'embedEnabled'      => true,
			'publicAddress'     => $verified ? 'https://' . $domain : 'https://app.casazen.example',
			'publicAddressKind' => $verified ? 'customDomain' : 'casazen',
			'domain'            => array(
				'orgId'                    => CASAZEN_TEST_ORG,
				'publicHostMode'           => '' === $domain ? 'CasazenPath' : 'CustomDomain',
				'customDomain'             => '' === $domain ? null : $domain,
				'domainVerificationStatus' => '' === $domain ? 'Pending' : $state,
				'canUseCustomDomain'       => true,
				'dnsInstructions'          => '' === $domain ? null : array(
					'cnameHost'      => $domain,
					'cnameTarget'    => 'cname.dns-target.example.net',
					'txtHost'        => '_casazen-verify.' . $domain,
					'txtValue'       => 'casazen-verify=txt-value-of-the-test',
					'sslNote'        => 'Server note.',
					'aRecordValues'  => array( '192.0.2.10' ),
					'vercelTxtHost'  => null,
					'vercelTxtValue' => null,
				),
				'publicUrls'               => array(
					'pathUrl'         => 'https://app.casazen.example/s/agenzia-esempio',
					'subdomainUrl'    => null,
					'customDomainUrl' => $verified ? 'https://' . $domain : null,
				),
				'status'                   => array(
					'detail'              => ( '' === $domain || $verified ) ? null : 'ownership_txt_missing',
					'message'             => ( '' === $domain || $verified ) ? null : 'The ownership record is missing.',
					'checkedAt'           => '2026-11-27T10:00:00Z',
					'verifiedAt'          => $verified ? '2026-11-27T10:00:00Z' : null,
					'activationAvailable' => true,
					'autoCheckActive'     => '' !== $domain && ! $verified,
				),
				'surfaces'                 => array(
					'guestAreaOnOwnDomain'   => true,
					'ownerPortalOnOwnDomain' => true,
					'useOwnDomainForLinks'   => false,
					'ownerLoginHostState'    => 'Pending',
					'ownerLoginAutomatic'    => false,
					'effective'              => array(
						'guestArea'        => $verified,
						'ownerPortal'      => false,
						'ownerLoginReady'  => false,
						'linksOnOwnDomain' => false,
					),
				),
				'tracking'                 => null,
			),
		);
		if ( isset( $override['domain'] ) ) {
			$account['domain'] = array_merge( $account['domain'], $override['domain'] );
			unset( $override['domain'] );
		}
		return array_merge( $account, $override );
	}

	/**
	 * Stores a connected site as «Connect to CasaZen» leaves it, with the copy of an account.
	 *
	 * @param array|null $account The account to keep a copy of, or null for no copy.
	 * @return void
	 */
	protected function connect_site( $account = null ) {
		Link::save(
			array(
				'token'         => CASAZEN_TEST_TOKEN,
				'connection_id' => CASAZEN_TEST_CONNECTION,
				'org_slug'      => 'agenzia-esempio',
				'org_name'      => 'Agenzia Esempio',
				'site_url'      => 'https://example.org',
				'app_origin'    => Build_Config::app_origin(),
				'api_base'      => CASAZEN_TEST_API,
				'connected_at'  => time(),
			)
		);
		Account::forget();
		if ( null !== $account ) {
			Account::store( Account::read( $account ) );
		}
	}

	/**
	 * Makes the copy of the account older, as if CasaZen had been asked that many seconds ago.
	 *
	 * @param int $seconds How old.
	 * @return void
	 */
	protected function age_account( $seconds ) {
		$copy               = get_transient( Account::CACHE );
		$copy['fetched_at'] = time() - $seconds;
		set_transient( Account::CACHE, $copy, HOUR_IN_SECONDS );
	}

	/**
	 * Stores settings as they are, without the sanitisation and without the refresh that a real save runs.
	 *
	 * @param array $values The values to change.
	 * @return void
	 */
	protected function store_settings( array $values ) {
		remove_filter( 'sanitize_option_' . Settings::OPTION, array( Settings::class, 'sanitize' ) );
		remove_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10 );
		remove_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10 );
		update_option( Settings::OPTION, array_merge( Settings::defaults(), $values ) );
		add_filter( 'sanitize_option_' . Settings::OPTION, array( Settings::class, 'sanitize' ) );
		add_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10, 2 );
		add_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10, 2 );
	}

	/**
	 * The site of the tests on https: the address of the site and of its administration (example.org).
	 *
	 * @return void
	 */
	protected function use_https_site() {
		$https = static function ( $url ) {
			return is_string( $url ) ? preg_replace( '#^http://#', 'https://', $url ) : $url;
		};
		add_filter( 'home_url', $https );
		add_filter( 'site_url', $https );
		add_filter( 'admin_url', $https );
	}

	/**
	 * Starts a connection and returns its state.
	 *
	 * @return string
	 */
	protected function start_state() {
		$start = Connect::start();
		$this->assertTrue( $start['ok'], 'The start must work: ' . $start['message'] );
		$query = array();
		parse_str( (string) wp_parse_url( $start['url'], PHP_URL_QUERY ), $query );
		return $query['state'];
	}

	/**
	 * Runs a handler that ends with a redirect and returns where it goes.
	 *
	 * @param callable $handler The handler.
	 * @return string
	 */
	protected function redirect_of( $handler ) {
		$catch = static function ( $location ) {
			throw new Casazen_Test_Redirected( $location ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- the address goes back to the test, it is never printed.
		};
		add_filter( 'wp_redirect', $catch );
		try {
			call_user_func( $handler );
		} catch ( Casazen_Test_Redirected $redirect ) {
			return $redirect->getMessage();
		} finally {
			remove_filter( 'wp_redirect', $catch );
		}
		$this->fail( 'The handler was expected to redirect.' );
		return '';
	}

	/**
	 * Whether a handler is refused with wp_die() (a 403 of WordPress).
	 *
	 * @param callable $handler The handler.
	 * @return bool
	 */
	protected function dies( $handler ) {
		$catch = static function ( $location ) {
			throw new Casazen_Test_Redirected( $location ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- the address goes back to the test, it is never printed.
		};
		add_filter( 'wp_redirect', $catch );
		try {
			call_user_func( $handler );
		} catch ( WPDieException $refused ) {
			return true;
		} catch ( Casazen_Test_Redirected $redirect ) {
			return false;
		} finally {
			remove_filter( 'wp_redirect', $catch );
		}
		return false;
	}

	/**
	 * Prints the screen of the plugin and returns what it printed.
	 *
	 * @param string $tab The tab, or an empty string for the first one.
	 * @return string
	 */
	protected function page_html( $tab = '' ) {
		Settings::register();
		Admin::register_fields();
		if ( '' !== $tab ) {
			$_GET['tab'] = $tab;
		}
		ob_start();
		Admin::render_page();
		$html = (string) ob_get_clean();
		unset( $_GET['tab'] );
		return $html;
	}
}
