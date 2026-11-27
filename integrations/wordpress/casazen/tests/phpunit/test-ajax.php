<?php
/**
 * Tests of the refresh of the screen through admin-ajax: `wp_ajax_casazen_account` and `wp_ajax_casazen_verify`.
 *
 * @package Casazen
 */

use Casazen\Account;
use Casazen\Admin;
use Casazen\Domain;

require_once __DIR__ . '/includes/casazen-api-stub.php';

// phpcs:disable Generic.Files.OneObjectStructurePerFile.MultipleFound -- the exception below is a helper of the test class of this file alone.

/**
 * Thrown by the admin-ajax die handler of the tests, so that a handler does not reach its `die`.
 */
class Casazen_Test_Ajax_Done extends Exception {
}

/**
 * AC 4 of the domain: the refresh is capped and checks the nonce and the capability.
 */
class Test_Ajax extends WP_UnitTestCase {

	use Casazen_Api_Stub;

	/**
	 * The stub of the API, the admin-ajax actions of the plugin (hooked only in the admin) and a connected site whose domain waits.
	 */
	public function set_up() {
		parent::set_up();
		$_POST    = array();
		$_REQUEST = array();
		$this->start_stub();
		$this->use_https_site();
		Domain::init();
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$this->connect_site( $this->account( 'prenota.example.com', 'Pending' ) );
	}

	/**
	 * Cleans what a test put in the request.
	 */
	public function tear_down() {
		$_POST    = array();
		$_REQUEST = array();
		parent::tear_down();
	}

	/**
	 * The die handler of admin-ajax in the tests.
	 *
	 * @param mixed $message What wp_die() was given.
	 * @return void
	 * @throws Casazen_Test_Ajax_Done Always.
	 */
	public function stop( $message ) {
		throw new Casazen_Test_Ajax_Done( is_scalar( $message ) ? (string) $message : '' ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- it goes back to the test, it is never printed.
	}

	/**
	 * Runs an admin-ajax action with a nonce and returns its decoded JSON answer.
	 *
	 * @param string      $action The action.
	 * @param string|null $nonce  The nonce sent, or null for none.
	 * @return array|null
	 */
	private function ajax( $action, $nonce ) {
		$fields   = null === $nonce ? array() : array( 'nonce' => $nonce );
		$_POST    = $fields;
		$_REQUEST = $fields;
		$handler  = function () {
			return array( $this, 'stop' );
		};
		add_filter( 'wp_doing_ajax', '__return_true' );
		add_filter( 'wp_die_ajax_handler', $handler, PHP_INT_MAX );
		ob_start();
		try {
			do_action( 'wp_ajax_' . $action );
		} catch ( Casazen_Test_Ajax_Done $done ) {
			unset( $done );
		} catch ( WPDieException $died ) {
			unset( $died );
		} finally {
			$output = (string) ob_get_clean();
			remove_filter( 'wp_die_ajax_handler', $handler, PHP_INT_MAX );
			remove_filter( 'wp_doing_ajax', '__return_true' );
		}
		$decoded = json_decode( $output, true );
		return is_array( $decoded ) ? $decoded : null;
	}

	/**
	 * Without the nonce, with another nonce, or for a user who cannot manage options, nothing is asked of CasaZen; with both, CasaZen
	 * is asked at most once in 25 seconds, and the answer holds no credential.
	 */
	public function test_the_refresh_checks_the_nonce_and_the_capability_and_is_capped() {
		$this->route( 'GET', '/api/site/v1/account', 200, $this->account( 'prenota.example.com', 'Pending' ) );
		$this->route( 'POST', '/api/site/v1/domain/verify', 200, array() );
		$this->age_account( 60 );

		$this->assertFalse( $this->ajax( Domain::AJAX_ACCOUNT, null )['success'], 'No nonce.' );
		$this->assertFalse( $this->ajax( Domain::AJAX_ACCOUNT, wp_create_nonce( 'another-action' ) )['success'], 'Another nonce.' );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$this->assertFalse( $this->ajax( Domain::AJAX_ACCOUNT, wp_create_nonce( Domain::AJAX_NONCE ) )['success'], 'A user without manage_options.' );
		$this->assertFalse( $this->ajax( Domain::AJAX_VERIFY, wp_create_nonce( Domain::AJAX_NONCE ) )['success'], 'A user without manage_options cannot check the domain.' );
		$this->assertSame( array(), $this->calls, 'Nothing was asked of CasaZen.' );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$answer = $this->ajax( Domain::AJAX_ACCOUNT, wp_create_nonce( Domain::AJAX_NONCE ) );
		$this->assertTrue( $answer['success'] );
		$this->assertTrue( $answer['data']['connected'] );
		$this->assertTrue( $answer['data']['pending'] );
		$this->assertSame( Account::fingerprint( Account::cached() ), $answer['data']['fingerprint'] );
		$this->assertStringNotContainsString( CASAZEN_TEST_TOKEN, (string) wp_json_encode( $answer ) );
		$this->assertCount( 1, $this->calls_to( '/api/site/v1/account', 'GET' ) );

		// A second refresh right after: the copy is younger than 25 seconds, so CasaZen is not asked again.
		$this->assertTrue( $this->ajax( Domain::AJAX_ACCOUNT, wp_create_nonce( Domain::AJAX_NONCE ) )['success'] );
		$this->assertCount( 1, $this->calls_to( '/api/site/v1/account', 'GET' ) );
	}

	/**
	 * «Check now» that finds the domain not active yet is a warning, never a success, through the form and through the script alike
	 * (the console says it the same way); only a check that finds it active is a success.
	 */
	public function test_check_now_that_finds_the_domain_not_active_yet_is_a_warning() {
		$checked = function ( $state ) {
			return array(
				'verify'  => array(
					'domainVerificationStatus' => $state,
					'customDomain'             => 'prenota.example.com',
					'checkedAt'                => '2026-11-27T10:05:00Z',
				),
				'account' => $this->account( 'prenota.example.com', $state ),
			);
		};
		$this->route( 'POST', '/api/site/v1/domain/verify', 200, $checked( 'Pending' ) );

		// The form (admin-post).
		$_REQUEST = array( Admin::NONCE_FIELD => wp_create_nonce( Domain::VERIFY_ACTION ) );
		$this->redirect_of( array( Domain::class, 'handle_verify' ) );
		$flash = Admin::take_flash();
		$this->assertSame( 'warning', $flash['type'], 'The form shows a check that found the domain not active as a warning.' );
		$this->assertStringContainsString( 'not active yet', $flash['text'] );

		// The script (admin-ajax).
		$this->assertTrue( $this->ajax( Domain::AJAX_VERIFY, wp_create_nonce( Domain::AJAX_NONCE ) )['success'] );
		$this->assertSame( 'warning', Admin::take_flash()['type'], 'The script shows it as a warning too.' );
		$this->assertCount( 2, $this->calls_to( '/api/site/v1/domain/verify', 'POST' ) );

		// The domain is active: that check is a success.
		$this->route( 'POST', '/api/site/v1/domain/verify', 200, $checked( 'Verified' ) );
		$this->assertTrue( $this->ajax( Domain::AJAX_VERIFY, wp_create_nonce( Domain::AJAX_NONCE ) )['success'] );
		$this->assertSame( 'success', Admin::take_flash()['type'] );
	}

	/**
	 * The limits of the script of the screen: every 30 seconds at most, for 15 minutes at most, and no storage of the browser.
	 */
	public function test_the_script_refreshes_at_most_every_30_seconds_for_at_most_15_minutes() {
		$script = (string) file_get_contents( CASAZEN_DIR . 'assets/admin.js' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file of the plugin.

		$this->assertStringContainsString( 'var POLL_INTERVAL_MS = 30 * 1000;', $script );
		$this->assertStringContainsString( 'var POLL_LIMIT_MS = 15 * 60 * 1000;', $script );
		$this->assertStringContainsString( "ask( 'casazen_account' )", $script );
		$this->assertStringNotContainsString( 'localStorage', $script );
		$this->assertSame( 25, Account::POLL_MIN_AGE, 'The server asks CasaZen at most every 25 seconds, whatever the browser does.' );
	}
}
