<?php
/**
 * Tests of the section «Domain» of a connected site: connect, check and remove the domain, what passes from it, the plan, and the
 * capability and the nonce of every form of the screen.
 *
 * Every HTTP call is stubbed (tests/phpunit/includes/casazen-api-stub.php): no test reaches the network.
 *
 * @package Casazen
 */

require_once __DIR__ . '/includes/casazen-api-stub.php';

use Casazen\Account;
use Casazen\Admin;
use Casazen\Api_Client;
use Casazen\Connect;
use Casazen\Connection;
use Casazen\Domain;
use Casazen\Link;
use Casazen\Settings;

/**
 * The domain of the agency, managed from the plugin.
 */
class Test_Domain extends WP_UnitTestCase {

	use Casazen_Api_Stub;

	/**
	 * A user who can manage options.
	 *
	 * @var int
	 */
	private $admin_id = 0;

	/**
	 * Users, the stub of the API, a site on https and a connected site.
	 */
	public function set_up() {
		parent::set_up();
		require_once ABSPATH . 'wp-admin/includes/admin.php';
		$this->admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$_REQUEST       = array();
		$_GET           = array();
		$_POST          = array();
		$this->start_stub();
		$this->use_https_site();
		wp_set_current_user( $this->admin_id );
		$this->connect_site( $this->account() );
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
	 * Posts a form of the screen with its nonce and returns where it goes.
	 *
	 * @param string   $action  The action of the form.
	 * @param callable $handler The handler.
	 * @param array    $fields  The fields of the form.
	 * @return string
	 */
	private function post_form( $action, $handler, array $fields = array() ) {
		$_POST    = $fields;
		$_REQUEST = array_merge( $fields, array( Admin::NONCE_FIELD => wp_create_nonce( $action ) ) );
		return $this->redirect_of( $handler );
	}

	/**
	 * The answers of the connection test for the address of an agency: on its own domain, and on the address of CasaZen.
	 *
	 * @return void
	 */
	private function healthy_addresses() {
		$this->route( 'GET', '/embed/v1/manifest.json', 200, $this->manifest() );
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
	}

	/**
	 * AC 4: «Connect domain» sends `PUT /api/site/v1/domain` with the credential as a Bearer header, and the screen shows the DNS
	 * records exactly as CasaZen gives them, with their copy buttons, the pending state and the refresh of the script.
	 */
	public function test_saving_a_domain_sends_the_put_with_the_bearer_and_shows_the_records() {
		$this->route( 'PUT', '/api/site/v1/domain', 200, $this->account( 'prenota.example.com', 'Pending' ) );

		$this->post_form( Domain::SAVE_ACTION, array( Domain::class, 'handle_save' ), array( Domain::DOMAIN_FIELD => ' https://Prenota.Example.com/ ' ) );

		$puts = $this->calls_to( '/api/site/v1/domain', 'PUT' );
		$this->assertCount( 1, $puts );
		$this->assertSame( array( 'customDomain' => 'prenota.example.com' ), $puts[0]['body'] );
		$this->assertSame( 'Bearer ' . CASAZEN_TEST_TOKEN, $puts[0]['headers']['Authorization'] );
		$this->assertSame( 'application/json', $puts[0]['headers']['Accept'] );
		$this->assertSame( 10, $puts[0]['args']['timeout'] );
		$this->assertSame( 0, $puts[0]['args']['redirection'] );
		$this->assertTrue( $puts[0]['args']['reject_unsafe_urls'] );
		$this->assertSame( 'success', Admin::take_flash()['type'] );

		$html = $this->page_html();
		foreach ( array( '_casazen-verify.prenota.example.com', 'casazen-verify=txt-value-of-the-test', 'cname.dns-target.example.net', '192.0.2.10' ) as $record ) {
			$this->assertStringContainsString( $record, $html, 'The record ' . $record . ' is shown.' );
		}
		$this->assertStringContainsString( 'data-casazen-copy="casazen-verify=txt-value-of-the-test"', $html );
		$this->assertStringContainsString( 'data-casazen-copy="cname.dns-target.example.net"', $html );
		$this->assertStringContainsString( 'Waiting for the DNS records', $html );
		$this->assertStringContainsString( 'The ownership record is missing.', $html, 'The explanation of CasaZen is shown.' );
		$this->assertStringContainsString( 'data-casazen-poll="1"', $html, 'The script refreshes a domain that waits.' );
		$this->assertStringContainsString( 'admin-post.php?action=casazen_domain_verify', $html );
	}

	/**
	 * AC 4: a `plan_required` answer shows the Pro message and no form; with a plan without custom domains no check is asked for.
	 */
	public function test_without_the_plan_the_pro_message_replaces_the_form_and_nothing_is_checked() {
		$this->route(
			'PUT',
			'/api/site/v1/domain',
			403,
			array(
				'code'         => 'plan_required',
				'requiredPlan' => 'Pro',
			)
		);

		$result = Domain::save( 'prenota.example.com' );

		$this->assertFalse( $result['ok'] );
		$this->assertSame( Api_Client::message( 'plan_required' ), $result['message'] );
		$html = $this->page_html();
		$this->assertStringContainsString( 'Your own domain needs the Pro plan.', $html );
		$this->assertStringContainsString( '/app/short-rent/settings/domain', $html, 'The console page of the domain is linked.' );
		$this->assertStringNotContainsString( 'name="casazen_domain"', $html, 'No form.' );
		$this->assertStringNotContainsString( 'casazen_domain_verify', $html );

		$this->connect_site( $this->account( 'prenota.example.com', 'Pending', array( 'domain' => array( 'canUseCustomDomain' => false ) ) ) );
		$this->calls = array();
		$this->assertFalse( Domain::verify()['ok'] );
		$this->assertSame( array(), $this->calls, 'No check of the domain is asked for.' );
	}

	/**
	 * AC 4 and 5: «Check now» sends the verification; a verified domain becomes the address of the settings (slug cleared) and the
	 * connection test runs for it.
	 */
	public function test_check_now_sends_the_verification_and_a_verified_domain_becomes_the_address() {
		$this->connect_site( $this->account( 'prenota.example.com', 'Pending' ) );
		$this->store_settings(
			array(
				'address'  => 'https://app.casazen.example',
				'org_slug' => 'agenzia-esempio',
			)
		);
		$this->healthy_addresses();
		$this->route(
			'POST',
			'/api/site/v1/domain/verify',
			200,
			array(
				'verify'  => array(
					'domainVerificationStatus' => 'Verified',
					'customDomain'             => 'prenota.example.com',
					'checkedAt'                => '2026-11-27T10:05:00Z',
				),
				'account' => $this->account( 'prenota.example.com', 'Verified' ),
			)
		);

		$this->post_form( Domain::VERIFY_ACTION, array( Domain::class, 'handle_verify' ) );

		$checks = $this->calls_to( '/api/site/v1/domain/verify', 'POST' );
		$this->assertCount( 1, $checks );
		$this->assertSame( 'Bearer ' . CASAZEN_TEST_TOKEN, $checks[0]['headers']['Authorization'] );
		$settings = Settings::get();
		$this->assertSame( 'https://prenota.example.com', $settings['address'] );
		$this->assertSame( '', $settings['org_slug'] );
		$this->assertSame( 'ok', Connection::cached()['code'], 'The connection test ran for the domain.' );
		$this->assertCount( 1, $this->calls_to( '/api/public/resolve-host', 'GET' ) );

		$html = $this->page_html();
		$this->assertStringContainsString( 'Your domain is active', $html );
		$this->assertStringContainsString( 'Your booking site answers on <code>https://prenota.example.com</code>', $html );
		$this->assertStringNotContainsString( 'data-casazen-poll', $html, 'A verified domain is not refreshed.' );
	}

	/**
	 * AC 4 and 5: «Remove domain» sends `{ "customDomain": null }` and the settings go back to the address of CasaZen with the slug.
	 */
	public function test_removing_the_domain_sends_null_and_the_address_goes_back_to_casazen() {
		$this->connect_site( $this->account( 'prenota.example.com', 'Verified' ) );
		$this->store_settings( array( 'address' => 'https://prenota.example.com' ) );
		$this->healthy_addresses();
		$this->route( 'GET', '/api/public/resolve-host', 404, array( 'code' => 'not_found' ) );
		$this->route( 'PUT', '/api/site/v1/domain', 200, $this->account() );

		$this->post_form( Domain::REMOVE_ACTION, array( Domain::class, 'handle_remove' ) );

		$puts = $this->calls_to( '/api/site/v1/domain', 'PUT' );
		$this->assertCount( 1, $puts );
		$this->assertSame( '{"customDomain":null}', $puts[0]['args']['body'] );
		$settings = Settings::get();
		$this->assertSame( 'https://app.casazen.example', $settings['address'] );
		$this->assertSame( 'agenzia-esempio', $settings['org_slug'] );
		$this->assertSame( 'ok', Connection::cached()['code'] );
	}

	/**
	 * The three choices are sent as they are ticked (all three, every time).
	 */
	public function test_the_choices_of_the_domain_are_sent_as_they_are_ticked() {
		$this->connect_site( $this->account( 'prenota.example.com', 'Verified' ) );
		$this->store_settings( array( 'address' => 'https://prenota.example.com' ) );
		$this->route( 'PUT', '/api/site/v1/domain/surfaces', 200, $this->account( 'prenota.example.com', 'Verified' ) );

		$this->post_form(
			Domain::SURFACES_ACTION,
			array( Domain::class, 'handle_surfaces' ),
			array(
				Domain::SURFACES_FIELD => array(
					'guest_area' => '1',
					'links'      => '1',
				),
			)
		);

		$puts = $this->calls_to( '/api/site/v1/domain/surfaces', 'PUT' );
		$this->assertCount( 1, $puts );
		$this->assertSame(
			array(
				'guestAreaOnOwnDomain'   => true,
				'ownerPortalOnOwnDomain' => false,
				'useOwnDomainForLinks'   => true,
			),
			$puts[0]['body']
		);
		$html = $this->page_html();
		$this->assertStringContainsString( 'What runs on your domain', $html );
		$this->assertStringContainsString( 'waiting for CasaZen to enable it', $html, 'The sign-in of the owners is read-only text.' );
	}

	/**
	 * A 401 on an action of the domain: the link goes and the screen says «No longer connected».
	 */
	public function test_a_401_on_an_action_drops_the_link() {
		$this->route( 'PUT', '/api/site/v1/domain', 401 );

		$result = Domain::save( 'prenota.example.com' );

		$this->assertFalse( $result['ok'] );
		$this->assertSame( Api_Client::message( 'unauthorized' ), $result['message'] );
		$this->assertNull( Link::get() );
		$this->assertSame( 'Agenzia Esempio', Link::revoked() );
		$this->assertNull( Account::cached() );
	}

	/**
	 * AC 8: every form of the screen checks the capability and the nonce of its own action: without them nothing is asked of
	 * CasaZen and nothing changes.
	 */
	public function test_every_form_checks_the_capability_and_the_nonce() {
		$this->route( 'GET', '/embed/v1/manifest.json', 200, $this->manifest() );
		$forms = array(
			Connect::START_ACTION      => array( Connect::class, 'handle_start' ),
			Connect::DISCONNECT_ACTION => array( Connect::class, 'handle_disconnect' ),
			Domain::SAVE_ACTION        => array( Domain::class, 'handle_save' ),
			Domain::REMOVE_ACTION      => array( Domain::class, 'handle_remove' ),
			Domain::VERIFY_ACTION      => array( Domain::class, 'handle_verify' ),
			Domain::SURFACES_ACTION    => array( Domain::class, 'handle_surfaces' ),
			Domain::REFRESH_ACTION     => array( Domain::class, 'handle_refresh' ),
		);
		$editor = self::factory()->user->create( array( 'role' => 'editor' ) );
		$_POST  = array( Domain::DOMAIN_FIELD => 'prenota.example.com' );

		foreach ( $forms as $action => $handler ) {
			wp_set_current_user( $editor );
			$_REQUEST = array( Admin::NONCE_FIELD => wp_create_nonce( $action ) );
			$this->assertTrue( $this->dies( $handler ), $action . ': a user without manage_options is refused.' );

			wp_set_current_user( $this->admin_id );
			$_REQUEST = array( Admin::NONCE_FIELD => wp_create_nonce( 'another-action' ) );
			$this->assertTrue( $this->dies( $handler ), $action . ': the nonce of another action is refused.' );
			$_REQUEST = array();
			$this->assertTrue( $this->dies( $handler ), $action . ': a form without a nonce is refused.' );
		}

		$this->assertSame( array(), $this->calls, 'Nothing was asked of CasaZen.' );
		$this->assertSame( CASAZEN_TEST_TOKEN, Link::get()['token'], 'The link did not change.' );
	}
}
