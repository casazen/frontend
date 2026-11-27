<?php
/**
 * Tests of «Connect to CasaZen»: the start, the return, the disconnection, a credential that CasaZen no longer accepts, and the
 * public pages of a connected site.
 *
 * Every HTTP call is stubbed (tests/phpunit/includes/casazen-api-stub.php): no test reaches the network.
 *
 * @package Casazen
 */

require_once __DIR__ . '/includes/casazen-api-stub.php';

use Casazen\Account;
use Casazen\Admin;
use Casazen\Api_Client;
use Casazen\Build_Config;
use Casazen\Connect;
use Casazen\Connection;
use Casazen\Link;
use Casazen\Settings;

/**
 * The connection of the site to the account of the agency.
 */
class Test_Connect extends WP_UnitTestCase {

	use Casazen_Api_Stub;

	/**
	 * A user who can manage options.
	 *
	 * @var int
	 */
	private $admin_id = 0;

	/**
	 * A user who cannot.
	 *
	 * @var int
	 */
	private $editor_id = 0;

	/**
	 * Users, the stub of the API, and a site on https.
	 */
	public function set_up() {
		parent::set_up();
		require_once ABSPATH . 'wp-admin/includes/admin.php';
		$this->admin_id  = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$this->editor_id = self::factory()->user->create( array( 'role' => 'editor' ) );
		$_REQUEST        = array();
		$_GET            = array();
		$_POST           = array();
		$this->start_stub();
		$this->use_https_site();
		wp_set_current_user( $this->admin_id );
	}

	/**
	 * Cleans what a test put in the request.
	 */
	public function tear_down() {
		$_REQUEST = array();
		$_GET     = array();
		$_POST    = array();
		parent::tear_down();
	}

	/**
	 * The answers of a healthy CasaZen: the manifest, the exchange, the account and the connection test of its address.
	 *
	 * @param array $account The account to answer with.
	 * @return void
	 */
	private function healthy_casazen( array $account ) {
		$this->route( 'GET', '/embed/v1/manifest.json', 200, $this->manifest() );
		$this->route( 'POST', '/api/public/site-connections/token', 200, $this->grant() );
		$this->route( 'GET', '/api/site/v1/account', 200, $account );
		$this->route(
			'GET',
			'/api/public/resolve-host',
			200,
			array(
				'slug'         => 'agenzia-esempio',
				'branding'     => array( 'displayName' => 'Agenzia Esempio' ),
				'embedEnabled' => true,
			)
		);
	}

	/**
	 * AC 1: the address of the console is exactly the one of the contract, with a fresh state and the S256 challenge of the
	 * verifier that the server keeps for itself.
	 */
	public function test_start_sends_the_browser_to_the_console_with_a_fresh_state_and_the_s256_challenge() {
		$this->route( 'GET', '/embed/v1/manifest.json', 200, $this->manifest() );

		$start = Connect::start();

		$this->assertTrue( $start['ok'] );
		$parts = wp_parse_url( $start['url'] );
		$this->assertSame( Build_Config::app_origin() . '/app/connect/wordpress', $parts['scheme'] . '://' . $parts['host'] . ( isset( $parts['port'] ) ? ':' . $parts['port'] : '' ) . $parts['path'] );
		$query = array();
		parse_str( $parts['query'], $query );
		$this->assertSame( array( 'site', 'return', 'state', 'challenge', 'method' ), array_keys( $query ) );
		$this->assertSame( 'https://example.org', $query['site'], 'The site is the origin of the site.' );
		$this->assertSame( admin_url( 'options-general.php?page=casazen' ), $query['return'], 'CasaZen comes back to the screen of the plugin.' );
		$this->assertSame( 'S256', $query['method'] );
		$this->assertSame( 1, preg_match( '/^[0-9a-f]{64}$/', $query['state'] ), 'The state is 32 random bytes in hexadecimal.' );

		// The server keeps the state and the verifier, for this user and for 15 minutes; only the challenge leaves it.
		$pending = get_transient( Connect::pending_key() );
		$this->assertSame( $query['state'], $pending['state'] );
		$this->assertSame( 1, preg_match( '/^[A-Za-z0-9_-]{43}$/', $pending['verifier'] ), 'The verifier is 32 random bytes in base64url.' );
		$this->assertSame( rtrim( strtr( base64_encode( hash( 'sha256', $pending['verifier'], true ) ), '+/', '-_' ), '=' ), $query['challenge'] ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- S256 written out by hand.
		$this->assertStringNotContainsString( $pending['verifier'], $start['url'] );
		$this->assertSame( CASAZEN_TEST_API, $pending['api_base'], 'The address of the API comes from the manifest of the console.' );
		if ( ! wp_using_ext_object_cache() ) {
			$this->assertEqualsWithDelta( time() + 15 * MINUTE_IN_SECONDS, (int) get_option( '_transient_timeout_' . Connect::pending_key() ), 10 );
		}

		// A second start makes another state and another verifier.
		$again = array();
		parse_str( (string) wp_parse_url( Connect::start()['url'], PHP_URL_QUERY ), $again );
		$this->assertNotSame( $query['state'], $again['state'] );
		$this->assertNotSame( $query['challenge'], $again['challenge'] );
	}

	/**
	 * AC 1: without the capability or the nonce nothing happens (WordPress answers 403): no request, nothing kept.
	 */
	public function test_start_needs_the_capability_and_the_nonce() {
		$this->route( 'GET', '/embed/v1/manifest.json', 200, $this->manifest() );

		wp_set_current_user( $this->editor_id );
		$_REQUEST = array( Admin::NONCE_FIELD => wp_create_nonce( Connect::START_ACTION ) );
		$this->assertTrue( $this->dies( array( Connect::class, 'handle_start' ) ), 'A user without manage_options is refused.' );
		$this->assertFalse( get_transient( Connect::pending_key() ) );

		wp_set_current_user( $this->admin_id );
		foreach ( array( 'not-a-nonce', wp_create_nonce( 'something-else' ), null ) as $nonce ) {
			$_REQUEST = null === $nonce ? array() : array( Admin::NONCE_FIELD => $nonce );
			$this->assertTrue( $this->dies( array( Connect::class, 'handle_start' ) ), 'A request without the right nonce is refused.' );
		}
		$this->assertSame( array(), $this->calls, 'Nothing is asked of CasaZen.' );
		$this->assertFalse( get_transient( Connect::pending_key() ) );

		$_REQUEST = array( Admin::NONCE_FIELD => wp_create_nonce( Connect::START_ACTION ) );
		$location = $this->redirect_of( array( Connect::class, 'handle_start' ) );
		$this->assertStringStartsWith( Build_Config::app_origin() . '/app/connect/wordpress?site=', $location );
	}

	/**
	 * AC 2: a wrong or missing state, a return for another user and a replay store nothing, and nothing is exchanged.
	 */
	public function test_a_wrong_missing_foreign_or_replayed_return_stores_nothing() {
		$this->healthy_casazen( $this->account( 'prenota.example.com', 'Verified' ) );
		$code = 'code-of-casazen-0123456789';

		$state  = $this->start_state();
		$result = Connect::finish( $code, '' );
		$this->assertFalse( $result['ok'] );
		$this->assertNotSame( '', $result['message'] );
		$this->assertFalse( Connect::finish( $code, $state )['ok'], 'The request is used once: after a wrong return the state is spent.' );

		$this->start_state();
		$this->assertFalse( Connect::finish( $code, str_repeat( 'a', 64 ) )['ok'], 'A state that is not the one kept.' );

		$state = $this->start_state();
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$this->assertFalse( Connect::finish( $code, $state )['ok'], 'The request of another user.' );
		wp_set_current_user( $this->admin_id );

		$this->assertSame( array(), $this->calls_to( '/api/public/site-connections/token' ), 'No code is exchanged without the state of the user.' );
		$this->assertFalse( get_option( Link::OPTION ) );
		$this->assertSame( Settings::defaults(), Settings::get() );

		// The request of the user is still there: it completes once, and its replay is refused.
		$this->assertTrue( Connect::finish( $code, $state )['ok'] );
		Link::forget();
		$this->assertFalse( Connect::finish( $code, $state )['ok'], 'A replay of the same return.' );
		$this->assertFalse( get_option( Link::OPTION ) );
	}

	/**
	 * AC 2: a failed exchange stores nothing and says why in one message; a CasaZen without the connection (404) points at the
	 * manual set-up; a credential that cannot read the account is given back.
	 */
	public function test_a_failed_exchange_stores_nothing_and_says_why() {
		$this->route( 'GET', '/embed/v1/manifest.json', 200, $this->manifest() );
		$cases = array(
			'expired or used code' => array( 400, array( 'code' => 'site_connection_invalid_grant' ), 'invalid_grant' ),
			'older CasaZen'        => array( 404, null, 'not_found' ),
			'rate limited'         => array( 429, null, 'rate_limited' ),
			'server error'         => array( 503, null, 'unreachable' ),
			'not an answer'        => array( 200, array( 'accessToken' => 'not-a-credential' ), 'unexpected' ),
		);
		foreach ( $cases as $label => $case ) {
			$this->route( 'POST', '/api/public/site-connections/token', $case[0], $case[1] );
			$result = Connect::finish( 'code-of-casazen-0123456789', $this->start_state() );
			$this->assertFalse( $result['ok'], $label );
			$this->assertSame( Api_Client::message( $case[2] ), $result['message'], $label );
			$this->assertFalse( get_option( Link::OPTION ), $label );
		}
		$this->assertStringContainsString( 'manual set-up', Api_Client::message( 'not_found' ) );
		$this->assertSame( array(), $this->calls_to( '/api/site/v1/account' ), 'No account is read without a credential.' );

		// The exchange works but the account is refused: the credential goes back to CasaZen and nothing is stored.
		$this->route( 'POST', '/api/public/site-connections/token', 200, $this->grant() );
		$this->route(
			'GET',
			'/api/site/v1/account',
			403,
			array(
				'code'   => 'commercial_module_required',
				'module' => 'direct-booking',
			)
		);
		$this->route( 'DELETE', '/api/site/v1/connection', 204 );
		$result = Connect::finish( 'code-of-casazen-0123456789', $this->start_state() );
		$this->assertFalse( $result['ok'] );
		$this->assertSame( Api_Client::message( 'module_required' ), $result['message'] );
		$deleted = $this->calls_to( '/api/site/v1/connection', 'DELETE' );
		$this->assertCount( 1, $deleted );
		$this->assertSame( 'Bearer ' . CASAZEN_TEST_TOKEN, $deleted[0]['headers']['Authorization'] );
		$this->assertFalse( get_option( Link::OPTION ) );
		$this->assertNull( Account::cached() );
		$this->assertSame( Settings::defaults(), Settings::get() );
	}

	/**
	 * AC 2: a good return exchanges the code with the verifier, stores the link (autoload off), sets the address of the agency
	 * (no slug on its own domain), runs the connection test and says «Connected to …» with the guided setup as the next step; the
	 * browser lands on the screen without the code in its address.
	 */
	public function test_a_good_return_stores_the_link_fills_in_the_address_and_says_connected() {
		$this->healthy_casazen( $this->account( 'prenota.example.com', 'Verified' ) );
		$this->store_settings(
			array(
				'address'  => 'https://old.example.com',
				'org_slug' => 'old-slug',
			)
		);
		$state    = $this->start_state();
		$verifier = get_transient( Connect::pending_key() )['verifier'];

		$_GET     = array(
			'page'         => 'casazen',
			'casazen_code' => 'code-of-casazen-0123456789',
			'state'        => $state,
		);
		$location = $this->redirect_of( array( Connect::class, 'maybe_handle_return' ) );

		$this->assertSame( admin_url( 'options-general.php?page=casazen' ), $location, 'The code does not stay in the address.' );

		$exchanges = $this->calls_to( '/api/public/site-connections/token', 'POST' );
		$this->assertCount( 1, $exchanges );
		$this->assertSame(
			array(
				'code'         => 'code-of-casazen-0123456789',
				'codeVerifier' => $verifier,
				'siteUrl'      => 'https://example.org',
			),
			$exchanges[0]['body']
		);
		$this->assertArrayNotHasKey( 'Authorization', $exchanges[0]['headers'] );
		$this->assertSame( 10, $exchanges[0]['args']['timeout'] );
		$this->assertSame( 0, $exchanges[0]['args']['redirection'] );
		$this->assertTrue( $exchanges[0]['args']['reject_unsafe_urls'], 'The safe request of WordPress.' );
		$accounts = $this->calls_to( '/api/site/v1/account', 'GET' );
		$this->assertCount( 1, $accounts );
		$this->assertSame( 'Bearer ' . CASAZEN_TEST_TOKEN, $accounts[0]['headers']['Authorization'] );

		$link = Link::get();
		$this->assertSame( CASAZEN_TEST_TOKEN, $link['token'] );
		$this->assertSame( CASAZEN_TEST_CONNECTION, $link['connection_id'] );
		$this->assertSame( 'Agenzia Esempio', $link['org_name'] );
		$this->assertSame( 'https://example.org', $link['site_url'] );
		$this->assertSame( CASAZEN_TEST_API, $link['api_base'] );
		$this->assertSame( Build_Config::app_origin(), $link['app_origin'] );
		$this->assertArrayNotHasKey( Link::OPTION, wp_load_alloptions(), 'The link is not autoloaded.' );

		$settings = Settings::get();
		$this->assertSame( 'https://prenota.example.com', $settings['address'] );
		$this->assertSame( '', $settings['org_slug'], 'On its own domain the slug is empty.' );
		$this->assertSame( 'ok', Connection::cached()['code'], 'The connection test ran for the new address.' );
		$this->assertFalse( get_transient( Connect::pending_key() ), 'The request is spent.' );

		$html = $this->page_html();
		$this->assertStringContainsString( 'Connected to Agenzia Esempio.', $html );
		$this->assertStringContainsString( 'tab=setup', $html, 'The guided setup is the next step.' );
		$this->assertStringContainsString( 'Open the guided setup', $html );
	}

	/**
	 * On the address of CasaZen (no domain of its own yet) the slug of the agency fills in the slug of the settings.
	 */
	public function test_on_the_casazen_address_the_slug_is_kept() {
		$this->healthy_casazen( $this->account() );
		$this->route( 'GET', '/api/public/resolve-host', 404, array( 'code' => 'not_found' ) );
		$this->route(
			'GET',
			'/api/public/orgs/agenzia-esempio',
			200,
			array(
				'slug'         => 'agenzia-esempio',
				'displayName'  => 'Agenzia Esempio',
				'embedEnabled' => true,
			)
		);

		$this->assertTrue( Connect::finish( 'code-of-casazen-0123456789', $this->start_state() )['ok'] );

		$settings = Settings::get();
		$this->assertSame( 'https://app.casazen.example', $settings['address'] );
		$this->assertSame( 'agenzia-esempio', $settings['org_slug'] );
		$this->assertSame( 'ok', Connection::cached()['code'] );
	}

	/**
	 * AC 6: «Disconnect» gives the credential back and forgets the link; a CasaZen that does not answer never blocks it.
	 */
	public function test_disconnect_gives_the_credential_back_and_an_unreachable_casazen_never_blocks_it() {
		$this->connect_site( $this->account() );
		$this->route( 'DELETE', '/api/site/v1/connection', 204 );
		$_REQUEST = array( Admin::NONCE_FIELD => wp_create_nonce( Connect::DISCONNECT_ACTION ) );

		$this->assertSame( admin_url( 'options-general.php?page=casazen' ), $this->redirect_of( array( Connect::class, 'handle_disconnect' ) ) );

		$deleted = $this->calls_to( '/api/site/v1/connection', 'DELETE' );
		$this->assertCount( 1, $deleted );
		$this->assertSame( 'Bearer ' . CASAZEN_TEST_TOKEN, $deleted[0]['headers']['Authorization'] );
		$this->assertFalse( get_option( Link::OPTION ) );
		$this->assertNull( Account::cached() );
		$this->assertSame( 'success', Admin::take_flash()['type'] );

		$this->connect_site( $this->account() );
		$this->route_error( 'DELETE', '/api/site/v1/connection' );
		$this->redirect_of( array( Connect::class, 'handle_disconnect' ) );
		$this->assertFalse( get_option( Link::OPTION ), 'The link goes even when CasaZen does not answer.' );
		$flash = Admin::take_flash();
		$this->assertSame( 'warning', $flash['type'] );
		$this->assertStringContainsString( 'remove it there', $flash['text'] );
	}

	/**
	 * AC 7: a 401 (the connection was removed in the console) turns the screen to «No longer connected» with the button «Connect to
	 * CasaZen», and the manual settings stay as they were.
	 */
	public function test_a_revoked_credential_shows_no_longer_connected_and_keeps_the_settings() {
		$this->connect_site( $this->account( 'prenota.example.com', 'Verified' ) );
		$this->store_settings(
			array(
				'address'      => 'https://prenota.example.com',
				'language_map' => array( 'it_IT' => 'it' ),
			)
		);
		$before = Settings::get();
		$this->route( 'GET', '/api/site/v1/account', 401 );

		$outcome = Account::refresh();

		$this->assertFalse( $outcome['ok'] );
		$this->assertSame( 'unauthorized', $outcome['error'] );
		$this->assertNull( Link::get(), 'The credential is gone.' );
		$this->assertSame( 'Agenzia Esempio', Link::revoked() );
		$this->assertSame( $before, Settings::get(), 'The settings stay.' );

		$html = $this->page_html();
		$this->assertStringContainsString( 'No longer connected', $html );
		$this->assertStringContainsString( 'admin-post.php?action=casazen_connect', $html );
		$this->assertStringContainsString( 'Connect to CasaZen', $html );
		$this->assertStringNotContainsString( 'id="casazen-domain"', $html );
		$this->assertStringContainsString( 'value="https://prenota.example.com"', $html, 'The manual address is still in its field.' );
	}

	/**
	 * AC 8: a public page of a connected site never calls CasaZen.
	 */
	public function test_a_public_page_of_a_connected_site_never_calls_casazen() {
		$this->connect_site( $this->account( 'prenota.example.com', 'Verified' ) );
		$this->store_settings( array( 'address' => 'https://prenota.example.com' ) );
		$page = self::factory()->post->create(
			array(
				'post_type'    => 'page',
				'post_status'  => 'publish',
				'post_content' => '[casazen_booking] [casazen_search] [casazen_guest_access] [casazen_owner_login]',
			)
		);
		$this->calls = array();

		$this->go_to( get_permalink( $page ) );
		ob_start();
		do_action( 'wp_enqueue_scripts' );
		echo do_shortcode( (string) get_post_field( 'post_content', $page ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- the test buffers the page.
		do_action( 'wp_footer' );
		$html = (string) ob_get_clean();

		$this->assertStringContainsString( 'data-casazen-widget="booking"', $html );
		$this->assertSame( array(), $this->calls, 'A public page never calls CasaZen.' );
		$this->assertStringNotContainsString( CASAZEN_TEST_TOKEN, $html );
	}
}
