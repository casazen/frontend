<?php
/**
 * Tests of the connection test: the calls, the normalised result, the cache and the background event.
 *
 * Every HTTP call is stubbed with the `pre_http_request` filter: no test reaches the network.
 *
 * @package Casazen
 */

use Casazen\Connection;
use Casazen\Destinations;
use Casazen\Settings;

/**
 * The server-side connection test.
 */
class Test_Connection extends WP_UnitTestCase {

	/**
	 * The requests the stub saw, in order: url and arguments.
	 *
	 * @var array[]
	 */
	private $requests = array();

	/**
	 * What the stub answers: the part of the url to look for => the reply.
	 *
	 * @var array
	 */
	private $replies = array();

	/**
	 * Installs the HTTP stub.
	 */
	public function set_up() {
		parent::set_up();
		$this->requests = array();
		$this->replies  = array();
		add_filter( 'pre_http_request', array( $this, 'fake_http' ), 10, 3 );

		// A good test of the connection makes the places of the search bar be read: that call has its own tests
		// (Test_Destinations). Here the connection is tested alone, so its requests are the only ones the stub counts.
		remove_action( 'casazen_connection_refreshed', array( Destinations::class, 'on_connection_refreshed' ) );
	}

	/**
	 * The HTTP stub: records the request and answers from $this->replies.
	 *
	 * @param false|array|WP_Error $preempt The value so far.
	 * @param array                $args    The request arguments.
	 * @param string               $url     The address.
	 * @return array|WP_Error
	 */
	public function fake_http( $preempt, $args, $url ) {
		$this->requests[] = array(
			'url'  => $url,
			'args' => $args,
		);
		foreach ( $this->replies as $needle => $reply ) {
			if ( false === strpos( $url, (string) $needle ) ) {
				continue;
			}
			if ( $reply instanceof WP_Error ) {
				return $reply;
			}
			return array(
				'headers'  => array(
					'set-cookie' => 'secret-session=cookie-secret',
					'x-private'  => 'header-secret',
				),
				'cookies'  => array(),
				'filename' => null,
				'response' => array(
					'code'    => $reply['status'],
					'message' => 'x',
				),
				'body'     => isset( $reply['raw'] ) ? $reply['raw'] : wp_json_encode( $reply['json'] ),
			);
		}
		return new WP_Error( 'http_request_failed', 'No reply was prepared for ' . $url );
	}

	/**
	 * Prepares the answer of an address, as JSON.
	 *
	 * @param string $needle The part of the url to look for.
	 * @param int    $status The HTTP status.
	 * @param mixed  $json   What the body holds.
	 */
	private function reply( $needle, $status, $json ) {
		$this->replies[ $needle ] = array(
			'status' => $status,
			'json'   => $json,
		);
	}

	/**
	 * Prepares an answer whose body is not JSON.
	 *
	 * @param string $needle The part of the url to look for.
	 * @param int    $status The HTTP status.
	 * @param string $raw    The body.
	 */
	private function reply_raw( $needle, $status, $raw ) {
		$this->replies[ $needle ] = array(
			'status' => $status,
			'raw'    => $raw,
		);
	}

	/**
	 * A manifest of the contract v1.
	 *
	 * @param array $overrides Fields to change.
	 * @return array
	 */
	private function manifest( array $overrides = array() ) {
		return array_merge(
			array(
				'v'       => 1,
				'apiBase' => 'https://api.example.com',
				'widgets' => array( 'booking', 'property', 'guest-access', 'search' ),
				'loader'  => 'https://prenota.example.com/embed/v1/embed.js',
				'search'  => 'https://prenota.example.com/embed/v1/search.js',
			),
			$overrides
		);
	}

	/**
	 * An answer of `resolve-host`.
	 *
	 * @param array $overrides Fields to change.
	 * @return array
	 */
	private function resolved( array $overrides = array() ) {
		return array_merge(
			array(
				'orgId'           => 'b7c1',
				'slug'            => 'casa-rossi',
				'publicHostMode'  => 'custom',
				'planTier'        => 'pro',
				'branding'        => array(
					'displayName' => 'Casa Rossi',
					'slug'        => 'casa-rossi',
				),
				'embedEnabled'    => true,
				'surfaces'        => array(
					'guestArea'   => true,
					'ownerPortal' => false,
				),
				'ownerLoginReady' => false,
				'tracking'        => array( 'gtmContainerId' => 'GTM-ABC123' ),
			),
			$overrides
		);
	}

	/**
	 * Stores the settings without the hooks that run a refresh, so a test starts from a known state.
	 *
	 * @param string $address The address.
	 * @param string $slug    The organisation slug.
	 */
	private function configure( $address, $slug = '' ) {
		remove_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10 );
		remove_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10 );
		update_option(
			Settings::OPTION,
			array_merge(
				Settings::defaults(),
				array(
					'address'  => $address,
					'org_slug' => $slug,
				)
			)
		);
		add_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10, 2 );
		add_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10, 2 );
	}

	/**
	 * How many events of a hook are waiting in the cron array.
	 *
	 * @param string $hook The hook of the event.
	 * @return int
	 */
	private function count_events( $hook ) {
		$count = 0;
		foreach ( (array) _get_cron_array() as $hooks ) {
			if ( isset( $hooks[ $hook ] ) ) {
				$count += count( $hooks[ $hook ] );
			}
		}
		return $count;
	}

	/**
	 * The test of a healthy address: the manifest, then `resolve-host`.
	 */
	public function test_ok_reads_the_manifest_then_resolve_host() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );

		$result = Connection::test( 'https://prenota.example.com', '' );

		$this->assertTrue( $result['ok'] );
		$this->assertSame( 'ok', $result['code'] );
		$this->assertSame( 'Casa Rossi', $result['agency'] );
		$this->assertSame( 'casa-rossi', $result['slug'] );
		$this->assertSame( 'https://api.example.com', $result['apiBase'] );
		$this->assertTrue( $result['embedEnabled'] );
		$this->assertSame(
			array(
				'guestArea'   => true,
				'ownerPortal' => false,
			),
			$result['surfaces']
		);
		$this->assertFalse( $result['ownerLoginReady'] );
		$this->assertIsInt( $result['checkedAt'] );

		$this->assertCount( 2, $this->requests );
		$this->assertSame( 'https://prenota.example.com/embed/v1/manifest.json', $this->requests[0]['url'] );
		$this->assertSame( 'https://api.example.com/api/public/resolve-host?host=prenota.example.com', $this->requests[1]['url'] );
	}

	/**
	 * The requests use the safe variant with the stated limits, send no cookie and do not name the site.
	 */
	public function test_requests_use_the_safe_variant_with_the_stated_limits() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );

		Connection::test( 'https://prenota.example.com', '' );

		$this->assertCount( 2, $this->requests );
		foreach ( $this->requests as $request ) {
			$args = $request['args'];
			$this->assertSame( 5, $args['timeout'] );
			$this->assertSame( 2, $args['redirection'] );
			$this->assertSame( 65536, $args['limit_response_size'] );
			$this->assertTrue( $args['sslverify'] );
			$this->assertTrue( $args['reject_unsafe_urls'] );
			$this->assertEmpty( $args['cookies'] );
			$this->assertStringStartsWith( 'CasaZen-WordPress/', $args['user-agent'] );
			$this->assertStringNotContainsString( home_url(), $args['user-agent'] );
		}
	}

	/**
	 * A development host is reached with the plain request, which the safe variant would refuse, on a development site.
	 */
	public function test_a_development_host_uses_the_plain_request() {
		add_filter( 'casazen_allow_development_hosts', '__return_true' );
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest( array( 'apiBase' => 'http://localhost:5000' ) ) );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );

		$result = Connection::test( 'http://localhost:5173', '' );

		$this->assertSame( 'ok', $result['code'] );
		$this->assertSame( 'http://localhost:5000', $result['apiBase'] );
		$this->assertCount( 2, $this->requests );
		$this->assertSame( 'http://localhost:5173/embed/v1/manifest.json', $this->requests[0]['url'] );
		$this->assertSame( 'http://localhost:5000/api/public/resolve-host?host=localhost', $this->requests[1]['url'] );
		foreach ( $this->requests as $request ) {
			$this->assertFalse( $request['args']['reject_unsafe_urls'] );
		}
	}

	/**
	 * A site that is not a development site never uses the plain request: an address on a development host is reached with
	 * the safe request too, and its manifest cannot name an http API address. On a network a site administrator could
	 * otherwise aim the server at its own loopback services.
	 */
	public function test_a_site_that_is_not_a_development_site_never_uses_the_plain_request() {
		add_filter( 'casazen_allow_development_hosts', '__return_false' );

		// An http API address is refused, and the only request made is the safe one.
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest( array( 'apiBase' => 'http://localhost:5000' ) ) );
		$result = Connection::test( 'http://localhost:5173', '' );
		$this->assertSame( 'manifest_invalid', $result['code'] );
		$this->assertCount( 1, $this->requests );
		$this->assertTrue( $this->requests[0]['args']['reject_unsafe_urls'], 'The development address is reached with the safe request.' );

		// An https API address is reached with the safe request as well.
		$this->requests = array();
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );
		$result = Connection::test( 'http://localhost:5173', '' );
		$this->assertSame( 'ok', $result['code'] );
		$this->assertCount( 2, $this->requests );
		foreach ( $this->requests as $request ) {
			$this->assertTrue( $request['args']['reject_unsafe_urls'] );
		}
	}

	/**
	 * By default only a site whose environment type is local or development may reach a development host; the filter is the
	 * way to opt in or out.
	 */
	public function test_development_hosts_are_allowed_by_default_only_on_a_development_site() {
		$expected = in_array( wp_get_environment_type(), array( 'local', 'development' ), true );
		$this->assertSame( $expected, Connection::allows_development_hosts() );

		add_filter( 'casazen_allow_development_hosts', '__return_true' );
		$this->assertTrue( Connection::allows_development_hosts() );
		remove_filter( 'casazen_allow_development_hosts', '__return_true' );

		add_filter( 'casazen_allow_development_hosts', '__return_false' );
		$this->assertFalse( Connection::allows_development_hosts() );
	}

	/**
	 * Even on a development site, only the development host itself is reached with the plain request: the API address that
	 * its manifest names is reached with the safe request unless it is a development host too. A manifest cannot aim the
	 * plain request (no refusal of private addresses, redirects not checked) at another host.
	 */
	public function test_a_development_address_reaches_other_hosts_with_the_safe_request() {
		add_filter( 'casazen_allow_development_hosts', '__return_true' );
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest( array( 'apiBase' => 'https://10.0.0.5' ) ) );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );

		$result = Connection::test( 'http://localhost:5173', '' );

		$this->assertSame( 'ok', $result['code'] );
		$this->assertCount( 2, $this->requests );
		$this->assertFalse( $this->requests[0]['args']['reject_unsafe_urls'], 'The development address itself uses the plain request.' );
		$this->assertSame( 'https://10.0.0.5/api/public/resolve-host?host=localhost', $this->requests[1]['url'] );
		$this->assertTrue( $this->requests[1]['args']['reject_unsafe_urls'], 'Any other host is reached with the safe request.' );
	}

	/**
	 * The manifest of a development address can name an http API address only on a development host: the address of another
	 * service, a metadata address or a name that merely contains «localhost» makes the manifest invalid and nothing else is
	 * called.
	 */
	public function test_a_development_address_cannot_point_the_api_at_an_http_host_that_is_not_a_development_host() {
		add_filter( 'casazen_allow_development_hosts', '__return_true' );

		$api_bases = array(
			'http://169.254.169.254',
			'http://10.0.0.5:9200',
			'http://api.example.com',
			'http://localhost.example.com',
			'http://evil-localhost',
		);
		foreach ( $api_bases as $api_base ) {
			$this->requests = array();
			$this->reply( '/embed/v1/manifest.json', 200, $this->manifest( array( 'apiBase' => $api_base ) ) );

			$result = Connection::test( 'http://localhost:5173', '' );

			$this->assertSame( 'manifest_invalid', $result['code'], $api_base . ' must be refused.' );
			$this->assertCount( 1, $this->requests, 'Nothing is called after the manifest that names ' . $api_base . '.' );
		}
	}

	/**
	 * A real address cannot send the server to an http development host: that manifest is invalid.
	 */
	public function test_a_real_address_cannot_point_the_api_at_a_development_host() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest( array( 'apiBase' => 'http://localhost:5000' ) ) );

		$result = Connection::test( 'https://prenota.example.com', '' );

		$this->assertSame( 'manifest_invalid', $result['code'] );
		$this->assertCount( 1, $this->requests );
	}

	/**
	 * The API of a real address is reached with the safe variant, even when its name looks like a development host.
	 */
	public function test_a_real_address_never_gets_the_plain_request() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest( array( 'apiBase' => 'https://api.internal.test' ) ) );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );

		Connection::test( 'https://prenota.example.com', '' );

		$this->assertCount( 2, $this->requests );
		$this->assertTrue( $this->requests[1]['args']['reject_unsafe_urls'] );
	}

	/**
	 * Embedding switched off is a warning: the result stays ok.
	 */
	public function test_embed_disabled_keeps_ok_true() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved( array( 'embedEnabled' => false ) ) );

		$result = Connection::test( 'https://prenota.example.com', '' );

		$this->assertTrue( $result['ok'] );
		$this->assertSame( 'embed_disabled', $result['code'] );
		$this->assertFalse( $result['embedEnabled'] );
	}

	/**
	 * A field the answer does not carry is unknown (null), never false.
	 */
	public function test_missing_fields_are_unknown_not_false() {
		$answer = $this->resolved();
		unset( $answer['embedEnabled'], $answer['surfaces'], $answer['ownerLoginReady'] );
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $answer );

		$result = Connection::test( 'https://prenota.example.com', '' );

		$this->assertSame( 'ok', $result['code'] );
		$this->assertNull( $result['embedEnabled'] );
		$this->assertNull( $result['surfaces'] );
		$this->assertNull( $result['ownerLoginReady'] );

		// A value that is not a JSON boolean is unknown too.
		$this->reply( '/api/public/resolve-host', 200, $this->resolved( array( 'embedEnabled' => 'yes' ) ) );
		$result = Connection::test( 'https://prenota.example.com', '' );
		$this->assertNull( $result['embedEnabled'] );
		$this->assertSame( 'ok', $result['code'] );
	}

	/**
	 * Without an address nothing is called.
	 */
	public function test_not_configured_makes_no_request() {
		$result = Connection::test( '', '' );

		$this->assertFalse( $result['ok'] );
		$this->assertSame( 'not_configured', $result['code'] );
		$this->assertSame( array(), $this->requests );

		$refreshed = Connection::refresh();
		$this->assertSame( 'not_configured', $refreshed['code'] );
		$this->assertSame( array(), $this->requests );
	}

	/**
	 * Cases where the address cannot be reached.
	 *
	 * @return array
	 */
	public static function provider_manifest_unreachable() {
		return array(
			'no answer' => array( new WP_Error( 'http_request_failed', 'timeout' ) ),
			'500'       => array( 500 ),
			'503'       => array( 503 ),
		);
	}

	/**
	 * No answer, or a server error, is «unreachable» and stops the test at the first call.
	 *
	 * @dataProvider provider_manifest_unreachable
	 *
	 * @param WP_Error|int $reply An error or an HTTP status.
	 */
	public function test_manifest_unreachable( $reply ) {
		if ( $reply instanceof WP_Error ) {
			$this->replies['/embed/v1/manifest.json'] = $reply;
		} else {
			$this->reply( '/embed/v1/manifest.json', $reply, array() );
		}

		$result = Connection::test( 'https://prenota.example.com', '' );

		$this->assertFalse( $result['ok'] );
		$this->assertSame( 'manifest_unreachable', $result['code'] );
		$this->assertCount( 1, $this->requests );
	}

	/**
	 * Manifests that are not valid.
	 *
	 * @return array
	 */
	public static function provider_invalid_manifests() {
		$good = array(
			'v'       => 1,
			'apiBase' => 'https://api.example.com',
			'widgets' => array( 'booking' ),
		);
		return array(
			'not found'                 => array( 404, $good, null ),
			'forbidden'                 => array( 403, $good, null ),
			'not json'                  => array( 200, null, 'this is not json' ),
			'an empty list'             => array( 200, array(), null ),
			'a list'                    => array( 200, array( 1, 2, 3 ), null ),
			'version 2'                 => array( 200, array_merge( $good, array( 'v' => 2 ) ), null ),
			'version as a string'       => array( 200, array_merge( $good, array( 'v' => '1' ) ), null ),
			'no version'                => array( 200, array_diff_key( $good, array( 'v' => 1 ) ), null ),
			'no widgets'                => array( 200, array_diff_key( $good, array( 'widgets' => 1 ) ), null ),
			'widgets is a string'       => array( 200, array_merge( $good, array( 'widgets' => 'booking' ) ), null ),
			'no api base'               => array( 200, array_diff_key( $good, array( 'apiBase' => 1 ) ), null ),
			'http api base'             => array( 200, array_merge( $good, array( 'apiBase' => 'http://api.example.com' ) ), null ),
			'javascript api base'       => array( 200, array_merge( $good, array( 'apiBase' => 'javascript:alert(1)' ) ), null ),
			'api base with credentials' => array( 200, array_merge( $good, array( 'apiBase' => 'https://u:p@api.example.com' ) ), null ),
			'api base with a query'     => array( 200, array_merge( $good, array( 'apiBase' => 'https://api.example.com?x=1' ) ), null ),
			'api base is a number'      => array( 200, array_merge( $good, array( 'apiBase' => 5 ) ), null ),
		);
	}

	/**
	 * An answer that is not a manifest of the contract v1 is «invalid» and stops the test at the first call.
	 *
	 * @dataProvider provider_invalid_manifests
	 *
	 * @param int         $status The HTTP status.
	 * @param array|null  $json   The JSON body.
	 * @param string|null $raw    A body that is not JSON.
	 */
	public function test_manifest_invalid( $status, $json, $raw ) {
		if ( null !== $raw ) {
			$this->reply_raw( '/embed/v1/manifest.json', $status, $raw );
		} else {
			$this->reply( '/embed/v1/manifest.json', $status, $json );
		}

		$result = Connection::test( 'https://prenota.example.com', '' );

		$this->assertFalse( $result['ok'] );
		$this->assertSame( 'manifest_invalid', $result['code'] );
		$this->assertCount( 1, $this->requests );
	}

	/**
	 * Answers of `resolve-host` that are not usable.
	 *
	 * @return array
	 */
	public static function provider_unusable_resolve_answers() {
		return array(
			'no answer'          => array( new WP_Error( 'http_request_failed', 'timeout' ), null ),
			'server error'       => array( 500, array() ),
			'rate limited'       => array( 429, array() ),
			'not json'           => array( 200, 'plain text' ),
			'no slug'            => array( 200, array( 'branding' => array( 'displayName' => 'X' ) ) ),
			'no display name'    => array(
				200,
				array(
					'slug'     => 'x',
					'branding' => array(),
				),
			),
			'no branding'        => array( 200, array( 'slug' => 'x' ) ),
			'branding a string'  => array(
				200,
				array(
					'slug'     => 'x',
					'branding' => 'x',
				),
			),
			'display name empty' => array(
				200,
				array(
					'slug'     => 'x',
					'branding' => array( 'displayName' => '  ' ),
				),
			),
		);
	}

	/**
	 * A failing or unexpected answer of the API is «unreachable».
	 *
	 * @dataProvider provider_unusable_resolve_answers
	 *
	 * @param WP_Error|int $status An error or an HTTP status.
	 * @param mixed        $body   The body: an array for JSON, a string for plain text.
	 */
	public function test_resolve_unreachable( $status, $body ) {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		if ( $status instanceof WP_Error ) {
			$this->replies['/api/public/resolve-host'] = $status;
		} elseif ( is_string( $body ) ) {
			$this->reply_raw( '/api/public/resolve-host', $status, $body );
		} else {
			$this->reply( '/api/public/resolve-host', $status, $body );
		}

		$result = Connection::test( 'https://prenota.example.com', '' );

		$this->assertFalse( $result['ok'] );
		$this->assertSame( 'resolve_unreachable', $result['code'] );
		$this->assertSame( 'https://api.example.com', $result['apiBase'] );
		$this->assertCount( 2, $this->requests );
	}

	/**
	 * A 404 with no slug means the host is unknown.
	 */
	public function test_host_not_found() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 404, array( 'title' => 'Not found' ) );

		$result = Connection::test( 'https://prenota.example.com', '' );

		$this->assertFalse( $result['ok'] );
		$this->assertSame( 'host_not_found', $result['code'] );
		$this->assertCount( 2, $this->requests );
	}

	/**
	 * A 404 of `resolve-host` with a slug asks the organisation by its slug.
	 */
	public function test_slug_falls_back_to_the_organisation_endpoint_on_a_404() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 404, array() );
		$this->reply(
			'/api/public/orgs/villa-rossi',
			200,
			array(
				'slug'         => 'villa-rossi',
				'displayName'  => 'Villa Rossi',
				'embedEnabled' => false,
			)
		);

		$result = Connection::test( 'https://app.example.com', 'villa-rossi' );

		$this->assertTrue( $result['ok'] );
		$this->assertSame( 'embed_disabled', $result['code'] );
		$this->assertSame( 'Villa Rossi', $result['agency'] );
		$this->assertSame( 'villa-rossi', $result['slug'] );
		$this->assertFalse( $result['embedEnabled'] );
		$this->assertNull( $result['surfaces'] );
		$this->assertNull( $result['ownerLoginReady'] );
		$this->assertCount( 3, $this->requests );
		$this->assertSame( 'https://api.example.com/api/public/orgs/villa-rossi', $this->requests[2]['url'] );
	}

	/**
	 * On the slug path a missing `embedEnabled` is unknown (null), never false.
	 */
	public function test_slug_path_leaves_embed_enabled_unknown_when_missing() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 404, array() );
		$this->reply( '/api/public/orgs/villa-rossi', 200, array( 'displayName' => 'Villa Rossi' ) );

		$result = Connection::test( 'https://app.example.com', 'villa-rossi' );

		$this->assertSame( 'ok', $result['code'] );
		$this->assertNull( $result['embedEnabled'] );
	}

	/**
	 * The organisation endpoint answers 404 or fails.
	 */
	public function test_slug_path_failures() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 404, array() );

		$this->reply( '/api/public/orgs/villa-rossi', 404, array() );
		$result = Connection::test( 'https://app.example.com', 'villa-rossi' );
		$this->assertSame( 'host_not_found', $result['code'] );

		$this->reply( '/api/public/orgs/villa-rossi', 500, array() );
		$result = Connection::test( 'https://app.example.com', 'villa-rossi' );
		$this->assertSame( 'resolve_unreachable', $result['code'] );

		$this->replies['/api/public/orgs/villa-rossi'] = new WP_Error( 'http_request_failed', 'timeout' );

		$result = Connection::test( 'https://app.example.com', 'villa-rossi' );
		$this->assertSame( 'resolve_unreachable', $result['code'] );
	}

	/**
	 * The slug is not used when `resolve-host` knows the host.
	 */
	public function test_slug_is_not_used_when_resolve_host_answers() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );

		$result = Connection::test( 'https://prenota.example.com', 'villa-rossi' );

		$this->assertSame( 'casa-rossi', $result['slug'] );
		$this->assertCount( 2, $this->requests );
	}

	/**
	 * The name of the agency is cleaned: no markup and a bounded length.
	 */
	public function test_agency_name_is_cleaned() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply(
			'/api/public/resolve-host',
			200,
			$this->resolved( array( 'branding' => array( 'displayName' => '<b>Villa</b> <script>alert(1)</script>Rossi' ) ) )
		);
		$result = Connection::test( 'https://prenota.example.com', '' );
		$this->assertSame( 'Villa Rossi', $result['agency'] );

		$this->reply(
			'/api/public/resolve-host',
			200,
			$this->resolved( array( 'branding' => array( 'displayName' => str_repeat( 'a', 500 ) ) ) )
		);
		$result = Connection::test( 'https://prenota.example.com', '' );
		$this->assertSame( 200, strlen( $result['agency'] ) );
	}

	/**
	 * The result carries only the normalised fields: no header, no cookie, no raw body.
	 */
	public function test_result_has_no_raw_body() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest( array( 'internal' => 'manifest-marker' ) ) );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved( array( 'internal' => 'raw-body-marker' ) ) );

		$result = Connection::test( 'https://prenota.example.com', '' );

		$this->assertSame(
			array( 'ok', 'code', 'agency', 'slug', 'apiBase', 'embedEnabled', 'surfaces', 'ownerLoginReady', 'checkedAt' ),
			array_keys( $result )
		);
		$json = wp_json_encode( $result );
		foreach ( array( 'raw-body-marker', 'manifest-marker', 'header-secret', 'cookie-secret', 'GTM-ABC123', 'b7c1' ) as $marker ) {
			$this->assertStringNotContainsString( $marker, $json );
		}

		// What is stored in the cache is the same small array.
		$this->configure( 'https://prenota.example.com' );
		$stored = Connection::refresh();
		$cached = get_transient( Connection::cache_key( 'https://prenota.example.com', '' ) );
		$this->assertSame( array_keys( $result ), array_keys( $cached ) );
		$this->assertSame( $stored, $cached );
	}

	/**
	 * Every code has a text.
	 */
	public function test_every_code_has_a_message() {
		foreach ( Connection::CODES as $code ) {
			$this->assertNotSame( '', Connection::message( $code ) );
		}
	}

	/**
	 * The name of the transient: the prefix and the first 12 characters of a hash.
	 */
	public function test_cache_key_is_the_first_12_characters_of_the_hash() {
		$this->assertSame(
			'casazen_conn_' . substr( md5( 'https://a.example.com|villa' ), 0, 12 ),
			Connection::cache_key( 'https://a.example.com', 'villa' )
		);
		$this->assertNotSame( Connection::cache_key( 'https://a.example.com', 'one' ), Connection::cache_key( 'https://a.example.com', 'two' ) );
	}

	/**
	 * A success is kept for 12 hours and a failure for 15 minutes.
	 */
	public function test_refresh_keeps_a_success_for_12_hours_and_a_failure_for_15_minutes() {
		if ( wp_using_ext_object_cache() ) {
			$this->markTestSkipped( 'The lifetime of a transient is only visible in the options table.' );
		}
		$this->configure( 'https://prenota.example.com' );
		$key = Connection::cache_key( 'https://prenota.example.com', '' );

		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );
		$result = Connection::refresh();
		$this->assertTrue( $result['ok'] );
		$this->assertSame( $result, get_transient( $key ) );
		$this->assertEqualsWithDelta( time() + 12 * HOUR_IN_SECONDS, (int) get_option( '_transient_timeout_' . $key ), 10 );

		$this->replies['/embed/v1/manifest.json'] = new WP_Error( 'http_request_failed', 'timeout' );
		$result                                   = Connection::refresh();
		$this->assertFalse( $result['ok'] );
		$this->assertSame( $result, get_transient( $key ) );
		$this->assertEqualsWithDelta( time() + 15 * MINUTE_IN_SECONDS, (int) get_option( '_transient_timeout_' . $key ), 10 );
	}

	/**
	 * `embed_disabled` is a success for the cache: it is kept for 12 hours.
	 */
	public function test_embed_disabled_is_kept_for_12_hours() {
		if ( wp_using_ext_object_cache() ) {
			$this->markTestSkipped( 'The lifetime of a transient is only visible in the options table.' );
		}
		$this->configure( 'https://prenota.example.com' );
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved( array( 'embedEnabled' => false ) ) );

		Connection::refresh();

		$key = Connection::cache_key( 'https://prenota.example.com', '' );
		$this->assertEqualsWithDelta( time() + 12 * HOUR_IN_SECONDS, (int) get_option( '_transient_timeout_' . $key ), 10 );
	}

	/**
	 * Refreshing tells the rest of the plugin.
	 */
	public function test_refresh_fires_the_action_with_the_result() {
		$this->configure( 'https://prenota.example.com' );
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );
		$seen = array();
		add_action(
			'casazen_connection_refreshed',
			function ( $result ) use ( &$seen ) {
				$seen[] = $result;
			}
		);

		$result = Connection::refresh();

		$this->assertCount( 1, $seen );
		$this->assertSame( $result, $seen[0] );
	}

	/**
	 * `cached()` only reads.
	 */
	public function test_cached_only_reads() {
		$this->configure( 'https://prenota.example.com' );

		$this->assertNull( Connection::cached() );
		$this->assertSame( array(), $this->requests );
		$this->assertSame( 0, $this->count_events( 'casazen_refresh_connection' ) );

		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );
		$result         = Connection::refresh();
		$this->requests = array();

		$this->assertSame( $result, Connection::cached() );
		$this->assertSame( array(), $this->requests );
	}

	/**
	 * While no address is set, the cache says so.
	 */
	public function test_cached_without_an_address_says_not_configured() {
		delete_option( Settings::OPTION );

		$result = Connection::cached();

		$this->assertSame( 'not_configured', $result['code'] );
		$this->assertFalse( $result['ok'] );
		$this->assertSame( 0, $this->count_events( 'casazen_refresh_connection' ) );
	}

	/**
	 * A public page with an empty cache makes no HTTP call and schedules ONE event.
	 */
	public function test_cache_miss_schedules_and_never_calls_http() {
		$this->configure( 'https://prenota.example.com' );
		$this->assertSame( 0, $this->count_events( 'casazen_refresh_connection' ) );

		$this->assertNull( Connection::current() );
		$this->assertNull( Connection::current() );
		$this->assertNull( Connection::current() );

		$this->assertSame( array(), $this->requests, 'A public page must never call CasaZen.' );
		$this->assertSame( 1, $this->count_events( 'casazen_refresh_connection' ) );
		$this->assertEqualsWithDelta( time() + 10, wp_next_scheduled( 'casazen_refresh_connection' ), 5 );
	}

	/**
	 * Nothing is scheduled while the plugin is inert, nor when the cache is full.
	 */
	public function test_current_schedules_nothing_without_a_miss() {
		delete_option( Settings::OPTION );
		$this->assertSame( 'not_configured', Connection::current()['code'] );
		$this->assertSame( 0, $this->count_events( 'casazen_refresh_connection' ) );

		$this->configure( 'https://prenota.example.com' );
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );
		Connection::refresh();
		$this->requests = array();

		$this->assertTrue( Connection::current()['ok'] );
		$this->assertSame( array(), $this->requests );
		$this->assertSame( 0, $this->count_events( 'casazen_refresh_connection' ) );
	}

	/**
	 * The scheduled event runs the refresh: that is the only network call after a miss.
	 */
	public function test_the_scheduled_event_runs_the_refresh() {
		$this->assertNotFalse( has_action( 'casazen_refresh_connection', array( 'Casazen\\Connection', 'refresh' ) ) );

		$this->configure( 'https://prenota.example.com' );
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );
		$this->assertNull( Connection::current() );
		$this->assertSame( array(), $this->requests );

		do_action( 'casazen_refresh_connection' );

		$this->assertCount( 2, $this->requests );
		$this->assertTrue( Connection::current()['ok'] );
	}

	/**
	 * A change of the address drops the old result and runs one refresh for the new address.
	 */
	public function test_cache_is_cleared_when_the_address_changes() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );
		$this->configure( 'https://one.example.com' );
		Connection::refresh();
		$old_key = Connection::cache_key( 'https://one.example.com', '' );
		$this->assertNotFalse( get_transient( $old_key ) );
		$this->requests = array();

		update_option( Settings::OPTION, array_merge( Settings::defaults(), array( 'address' => 'https://two.example.com' ) ) );

		$this->assertFalse( get_transient( $old_key ), 'The result of the old address must be dropped.' );
		$this->assertNotFalse( get_transient( Connection::cache_key( 'https://two.example.com', '' ) ), 'The new address is tested once.' );
		$this->assertCount( 2, $this->requests );
		$this->assertSame( 'https://two.example.com/embed/v1/manifest.json', $this->requests[0]['url'] );
	}

	/**
	 * A change of the slug does the same.
	 */
	public function test_cache_is_cleared_when_the_slug_changes() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );
		$this->configure( 'https://one.example.com', 'first' );
		Connection::refresh();
		$old_key        = Connection::cache_key( 'https://one.example.com', 'first' );
		$this->requests = array();

		update_option(
			Settings::OPTION,
			array_merge(
				Settings::defaults(),
				array(
					'address'  => 'https://one.example.com',
					'org_slug' => 'second',
				)
			)
		);

		$this->assertFalse( get_transient( $old_key ) );
		$this->assertNotFalse( get_transient( Connection::cache_key( 'https://one.example.com', 'second' ) ) );
		$this->assertCount( 2, $this->requests );
	}

	/**
	 * Any other change leaves the cache alone and calls nothing.
	 */
	public function test_other_changes_do_not_refresh() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );
		$this->configure( 'https://one.example.com' );
		$result         = Connection::refresh();
		$this->requests = array();

		update_option(
			Settings::OPTION,
			array_merge(
				Settings::defaults(),
				array(
					'address'     => 'https://one.example.com',
					'load_script' => false,
				)
			)
		);

		$this->assertSame( array(), $this->requests );
		$this->assertSame( $result, Connection::cached() );
	}

	/**
	 * The manifest of CasaZen names the API the way the app uses it, with `/api` already at its end: the endpoints are then
	 * asked below it and `/api` is not written twice. A bare host works too.
	 */
	public function test_an_api_base_that_ends_in_api_is_not_doubled() {
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest( array( 'apiBase' => 'https://casazen-api.example.com/api' ) ) );
		$this->reply( '/api/public/resolve-host', 200, $this->resolved() );

		$result = Connection::test( 'https://prenota.example.com', '' );

		$this->assertSame( 'ok', $result['code'] );
		$this->assertSame( 'https://casazen-api.example.com/api', $result['apiBase'] );
		$this->assertSame( 'https://casazen-api.example.com/api/public/resolve-host?host=prenota.example.com', $this->requests[1]['url'] );

		// On the CasaZen domain the organisation is asked for below the same API address.
		$this->requests = array();
		$this->replies  = array();
		$this->reply( '/embed/v1/manifest.json', 200, $this->manifest( array( 'apiBase' => 'https://casazen-api.example.com/api' ) ) );
		$this->reply( '/api/public/resolve-host', 404, array() );
		$this->reply( '/api/public/orgs/villa-rossi', 200, array( 'displayName' => 'Villa Rossi' ) );

		$result = Connection::test( 'https://casazen.example.org', 'villa-rossi' );

		$this->assertSame( 'ok', $result['code'] );
		$this->assertSame( 'https://casazen-api.example.com/api/public/orgs/villa-rossi', $this->requests[2]['url'] );
	}

	/**
	 * The address of an endpoint of the public API, for the two ways a manifest can name the API.
	 */
	public function test_api_url_adds_api_only_when_it_is_missing() {
		$this->assertSame( 'https://api.example.com/api/public/x', Connection::api_url( 'https://api.example.com', '/public/x' ) );
		$this->assertSame( 'https://api.example.com/api/public/x', Connection::api_url( 'https://api.example.com/', 'public/x' ) );
		$this->assertSame( 'https://api.example.com/api/public/x', Connection::api_url( 'https://api.example.com/api', '/public/x' ) );
		$this->assertSame( 'https://api.example.com/api/public/x', Connection::api_url( 'https://api.example.com/api/', '/public/x' ) );
		$this->assertSame( 'https://api.example.com/v2/api/public/x', Connection::api_url( 'https://api.example.com/v2/api', '/public/x' ) );
		$this->assertSame( 'https://api.example.com/v2/api/public/x', Connection::api_url( 'https://api.example.com/v2', '/public/x' ) );
		$this->assertSame( 'http://localhost:5000/api/public/x', Connection::api_url( 'http://localhost:5000/api', '/public/x' ) );
		// A host that is called `api` is not a path that ends in `/api`.
		$this->assertSame( 'https://api/api/public/x', Connection::api_url( 'https://api', '/public/x' ) );
		$this->assertSame( 'https://myapi.example.com/api/public/x', Connection::api_url( 'https://myapi.example.com', '/public/x' ) );
	}
}
