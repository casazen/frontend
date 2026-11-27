<?php
/**
 * The credential of a connected site is its only secret: no screen, notice, script data, setting, REST answer or result of the
 * client ever holds it.
 *
 * @package Casazen
 */

require_once __DIR__ . '/includes/casazen-api-stub.php';

use Casazen\Account;
use Casazen\Admin;
use Casazen\Api_Client;
use Casazen\Domain;
use Casazen\Link;
use Casazen\Settings;

/**
 * AC 3 of the connection: the credential never leaves the server.
 */
class Test_Link_Secret extends WP_UnitTestCase {

	use Casazen_Api_Stub;

	/**
	 * An administrator, the stub of the API and a site on https.
	 */
	public function set_up() {
		parent::set_up();
		require_once ABSPATH . 'wp-admin/includes/admin.php';
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$_GET = array();
		$this->start_stub();
		$this->use_https_site();
	}

	/**
	 * Cleans what a test put in the request.
	 */
	public function tear_down() {
		$_GET = array();
		parent::tear_down();
	}

	/**
	 * Every state of the screen, with the data of its script and the settings, is searched for the credential.
	 */
	public function test_no_state_of_the_screen_prints_the_credential() {
		$failed  = $this->account( 'prenota.example.com', 'Failed' );
		$waiting = $this->account(
			'prenota.example.com',
			'Pending',
			array(
				'domain' => array(
					'status'          => array(
						'detail'              => 'vercel_not_configured',
						'message'             => 'Activation is not available.',
						'checkedAt'           => null,
						'verifiedAt'          => null,
						'activationAvailable' => false,
						'autoCheckActive'     => false,
					),
					'dnsInstructions' => array(
						'cnameHost'      => 'prenota.example.com',
						'cnameTarget'    => 'cname.dns-target.example.net',
						'txtHost'        => '_casazen-verify.prenota.example.com',
						'txtValue'       => 'casazen-verify=txt',
						'aRecordValues'  => array(),
						'vercelTxtHost'  => '_vercel.prenota.example.com',
						'vercelTxtValue' => 'vc-domain-verify=prenota.example.com,abc',
					),
				),
			)
		);
		$states  = array(
			'not connected'              => function () {
				Link::forget();
			},
			'no longer connected'        => function () {
				$this->connect_site( $this->account() );
				Account::revoke();
			},
			'connected, no copy'         => function () {
				$this->connect_site( null );
			},
			'no domain, just connected'  => function () {
				$this->connect_site( $this->account() );
				Admin::flash( 'success', 'Connected to Agenzia Esempio.', Admin::NEXT_SETUP );
			},
			'waiting for the records'    => function () {
				$this->connect_site( $this->account( 'prenota.example.com', 'Pending' ) );
			},
			'activation not available'   => function () use ( $waiting ) {
				$this->connect_site( $waiting );
			},
			'verified, with the choices' => function () {
				$this->connect_site( $this->account( 'prenota.example.com', 'Verified' ) );
			},
			'failed'                     => function () use ( $failed ) {
				$this->connect_site( $failed );
				Admin::flash( 'error', Api_Client::message( 'domain_in_use' ) );
			},
			'no plan for a domain'       => function () {
				$this->connect_site( $this->account( '', 'Pending', array( 'domain' => array( 'canUseCustomDomain' => false ) ) ) );
			},
			'old data'                   => function () {
				$this->connect_site( $this->account( 'prenota.example.com', 'Pending' ) );
				$this->route_error( 'GET', '/api/site/v1/account' );
				Account::refresh();
			},
		);

		$GLOBALS['submenu'] = array();
		$hook               = Admin::add_menu();
		foreach ( $states as $label => $arrange ) {
			$arrange();
			$html = $this->page_html() . $this->page_html( Admin::TAB_SETUP );

			wp_dequeue_script( Admin::ASSET_HANDLE );
			wp_deregister_script( Admin::ASSET_HANDLE );
			Admin::enqueue_assets( $hook );
			$script_data = (string) wp_scripts()->get_data( Admin::ASSET_HANDLE, 'data' );

			$this->assertStringContainsString( 'casazenAdmin', $script_data, $label . ': the script of the screen has its data.' );
			foreach ( array( $html, $script_data, (string) wp_json_encode( Settings::get() ), (string) wp_json_encode( Domain::poll_state() ), (string) wp_json_encode( Link::summary() ), (string) wp_json_encode( Account::cached() ) ) as $where ) {
				$this->assertStringNotContainsString( CASAZEN_TEST_TOKEN, $where, $label . ': the credential was printed.' );
				$this->assertStringNotContainsString( 'czs_', $where, $label . ': a credential was printed.' );
			}
		}
	}

	/**
	 * The option of the settings, the REST answer of the settings and every result of the client hold no credential.
	 */
	public function test_the_credential_is_not_in_the_settings_rest_or_the_results_of_the_client() {
		$this->connect_site( $this->account() );

		$this->assertStringNotContainsString( CASAZEN_TEST_TOKEN, (string) wp_json_encode( get_option( Settings::OPTION ) ) );
		$this->assertArrayNotHasKey( Link::OPTION, wp_load_alloptions(), 'The link is not autoloaded.' );

		$response = rest_get_server()->dispatch( new WP_REST_Request( 'GET', '/wp/v2/settings' ) );
		$this->assertSame( 200, $response->get_status() );
		$this->assertStringNotContainsString( CASAZEN_TEST_TOKEN, (string) wp_json_encode( $response->get_data() ) );

		$this->route( 'GET', '/api/site/v1/account', 200, $this->account() );
		$this->route( 'PUT', '/api/site/v1/domain', 500, array( 'detail' => 'Server error.' ) );
		$this->route_error( 'POST', '/api/site/v1/domain/verify' );
		$results = array(
			Api_Client::request( CASAZEN_TEST_API, 'GET', '/site/v1/account', CASAZEN_TEST_TOKEN ),
			Api_Client::request( CASAZEN_TEST_API, 'PUT', '/site/v1/domain', CASAZEN_TEST_TOKEN, array( 'customDomain' => 'x.example.com' ) ),
			Api_Client::request( CASAZEN_TEST_API, 'POST', '/site/v1/domain/verify', CASAZEN_TEST_TOKEN ),
			Api_Client::request( 'http://api.example.com', 'GET', '/site/v1/account', CASAZEN_TEST_TOKEN ),
		);
		foreach ( $results as $result ) {
			$this->assertStringNotContainsString( CASAZEN_TEST_TOKEN, (string) wp_json_encode( $result ) );
		}
		$this->assertSame( 'unreachable', $results[2]['error'] );
		$this->assertSame( 'unexpected', $results[3]['error'], 'An http address of the API is refused.' );
		$this->assertCount( 3, $this->calls, 'The http address was not called: the credential goes over https only.' );
	}
}
