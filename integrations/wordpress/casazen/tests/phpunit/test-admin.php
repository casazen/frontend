<?php
/**
 * Tests of the admin side: the settings page, the notice, the plugin row and the «Test connection» form.
 *
 * @package Casazen
 */

use Casazen\Admin;
use Casazen\Connection;
use Casazen\Destinations;
use Casazen\Settings;

// phpcs:disable Generic.Files.OneObjectStructurePerFile.MultipleFound -- the exception below is a helper of the test class of this file alone.

/**
 * Thrown by the `wp_redirect` filter of the tests, so that the handler does not reach its `exit`.
 */
class Casazen_Test_Redirect extends Exception {
}

/**
 * The settings screen and its two forms.
 */
class Test_Admin extends WP_UnitTestCase {

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
	 * The requests the HTTP stub saw.
	 *
	 * @var string[]
	 */
	private $requests = array();

	/**
	 * What the HTTP stub answers: the part of the url => the JSON body.
	 *
	 * @var array
	 */
	private $replies = array();

	/**
	 * Creates the users and stubs the HTTP calls.
	 */
	public function set_up() {
		parent::set_up();
		require_once ABSPATH . 'wp-admin/includes/admin.php';
		$this->admin_id  = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$this->editor_id = self::factory()->user->create( array( 'role' => 'editor' ) );
		$this->requests  = array();
		$this->replies   = array();
		$_REQUEST        = array();
		$_GET            = array();
		$_POST           = array();
		add_filter( 'pre_http_request', array( $this, 'fake_http' ), 10, 3 );

		// A good test of the connection makes the places of the search bar be read: that call has its own tests
		// (Test_Destinations). Here the connection is tested alone, so its requests are the only ones the stub counts.
		remove_action( 'casazen_connection_refreshed', array( Destinations::class, 'on_connection_refreshed' ) );
	}

	/**
	 * Cleans what a test put in the request.
	 */
	public function tear_down() {
		$_REQUEST = array();
		$_GET     = array();
		$_POST    = array();
		unset( $GLOBALS['current_screen'] );
		parent::tear_down();
	}

	/**
	 * The HTTP stub.
	 *
	 * @param false|array|WP_Error $preempt The value so far.
	 * @param array                $args    The request arguments.
	 * @param string               $url     The address.
	 * @return array|WP_Error
	 */
	public function fake_http( $preempt, $args, $url ) {
		unset( $args );
		$this->requests[] = $url;
		foreach ( $this->replies as $needle => $body ) {
			if ( false !== strpos( $url, (string) $needle ) ) {
				return array(
					'headers'  => array(),
					'cookies'  => array(),
					'filename' => null,
					'response' => array(
						'code'    => 200,
						'message' => 'OK',
					),
					'body'     => wp_json_encode( $body ),
				);
			}
		}
		return new WP_Error( 'http_request_failed', 'No reply was prepared for ' . $url );
	}

	/**
	 * Makes the HTTP stub answer like a healthy CasaZen address.
	 */
	private function healthy_casazen() {
		$this->replies['/embed/v1/manifest.json']  = array(
			'v'       => 1,
			'apiBase' => 'https://api.example.com',
			'widgets' => array( 'booking' ),
		);
		$this->replies['/api/public/resolve-host'] = array(
			'slug'            => 'casa-rossi',
			'branding'        => array( 'displayName' => 'Casa Rossi' ),
			'embedEnabled'    => true,
			'ownerLoginReady' => true,
		);
	}

	/**
	 * Stores the values as they are, the way a polluted database would hold them: neither the sanitisation nor the refresh
	 * that a real save runs take part.
	 *
	 * @param array $values The values to change.
	 */
	private function store( array $values ) {
		remove_filter( 'sanitize_option_' . Settings::OPTION, array( Settings::class, 'sanitize' ) );
		remove_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10 );
		remove_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10 );
		update_option( Settings::OPTION, array_merge( Settings::defaults(), $values ) );
		add_filter( 'sanitize_option_' . Settings::OPTION, array( Settings::class, 'sanitize' ) );
		add_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10, 2 );
		add_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10, 2 );
	}

	/**
	 * Keeps a connection result with the given code for the saved address, as a test of the connection would.
	 *
	 * @param string $code One of the result codes.
	 */
	private function store_result( $code ) {
		$settings = Settings::get();
		set_transient(
			Connection::cache_key( $settings['address'], $settings['org_slug'] ),
			array(
				'ok'              => 'ok' === $code || 'embed_disabled' === $code,
				'code'            => $code,
				'agency'          => '',
				'slug'            => '',
				'apiBase'         => '',
				'embedEnabled'    => null,
				'surfaces'        => null,
				'ownerLoginReady' => null,
				'checkedAt'       => time(),
			),
			HOUR_IN_SECONDS
		);
	}

	/**
	 * Prints the settings page and returns what it printed.
	 *
	 * @return string
	 */
	private function page_html() {
		Settings::register();
		Admin::register_fields();
		ob_start();
		Admin::render_page();
		return (string) ob_get_clean();
	}

	/**
	 * Runs the handler of the «Test connection» form and returns the address it redirects to.
	 *
	 * @return string
	 */
	private function run_handler() {
		$catch = static function ( $location ) {
			throw new Casazen_Test_Redirect( $location ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- the address goes back to the test, it is never printed.
		};
		add_filter( 'wp_redirect', $catch );
		try {
			Admin::handle_test_connection();
		} catch ( Casazen_Test_Redirect $redirect ) {
			return $redirect->getMessage();
		} finally {
			remove_filter( 'wp_redirect', $catch );
		}
		$this->fail( 'The handler was expected to redirect.' );
		return '';
	}

	/**
	 * The form needs the capability and a valid nonce; without them nothing runs.
	 */
	public function test_test_connection_handler_requires_capability_and_nonce() {
		$this->store( array( 'address' => 'https://prenota.example.com' ) );
		$this->healthy_casazen();

		// No capability: an editor with a valid nonce is refused and CasaZen is not called.
		wp_set_current_user( $this->editor_id );
		$_REQUEST[ Admin::NONCE_FIELD ] = wp_create_nonce( Admin::TEST_ACTION );
		$refused                        = false;
		try {
			Admin::handle_test_connection();
		} catch ( WPDieException $e ) {
			$refused = true;
		}
		$this->assertTrue( $refused, 'A user without manage_options must be refused.' );
		$this->assertSame( array(), $this->requests );

		// A user who can manage options, but a nonce that is wrong, missing or made for another action.
		wp_set_current_user( $this->admin_id );
		$bad_nonces = array(
			'a wrong nonce'           => 'not-a-nonce',
			'a nonce of another form' => wp_create_nonce( 'something-else' ),
			'no nonce'                => null,
		);
		foreach ( $bad_nonces as $label => $nonce ) {
			$_REQUEST = array();
			if ( null !== $nonce ) {
				$_REQUEST[ Admin::NONCE_FIELD ] = $nonce;
			}
			$refused = false;
			try {
				Admin::handle_test_connection();
			} catch ( WPDieException $e ) {
				$refused = true;
			}
			$this->assertTrue( $refused, 'A request with ' . $label . ' must be refused.' );
			$this->assertSame( array(), $this->requests, 'Nothing is called for ' . $label . '.' );
		}

		// A valid nonce: the test runs and the answer is a redirect with the result code only.
		$_REQUEST = array( Admin::NONCE_FIELD => wp_create_nonce( Admin::TEST_ACTION ) );
		$location = $this->run_handler();

		$this->assertCount( 2, $this->requests );
		$query = array();
		parse_str( (string) wp_parse_url( $location, PHP_URL_QUERY ), $query );
		$this->assertSame(
			array(
				'page'           => 'casazen',
				'casazen_result' => 'ok',
			),
			$query
		);
		$this->assertStringContainsString( 'options-general.php', $location );
		$this->assertSame( 'ok', Connection::cached()['code'], 'The result of the test is stored.' );
	}

	/**
	 * Whatever is stored for the address and the other values is escaped where the page prints it.
	 */
	public function test_settings_page_escapes_the_address() {
		wp_set_current_user( $this->admin_id );
		$hostile = 'https://evil.example/"><script>alert(1)</script>';
		$this->store(
			array(
				'address'      => $hostile,
				'org_slug'     => '"><img src=x onerror=alert(2)>',
				'language_map' => array( '"><svg onload=alert(3)>' => 'it' ),
			)
		);
		set_transient(
			Connection::cache_key( $hostile, '"><img src=x onerror=alert(2)>' ),
			array(
				'ok'              => true,
				'code'            => 'ok',
				'agency'          => '<script>alert(4)</script>',
				'slug'            => 'x',
				'apiBase'         => 'https://api.example.com',
				'embedEnabled'    => true,
				'surfaces'        => null,
				'ownerLoginReady' => null,
				'checkedAt'       => time(),
			),
			HOUR_IN_SECONDS
		);

		$html = $this->page_html();

		foreach ( array( '<script>', '<img src=x', '<svg onload' ) as $raw ) {
			$this->assertStringNotContainsString( $raw, $html, 'The page printed ' . $raw . ' unescaped.' );
		}
		$this->assertStringContainsString( esc_attr( $hostile ), $html, 'The address is printed escaped in its field.' );
		$this->assertStringContainsString( esc_html( $hostile . '/embed/v1/embed.js' ), $html, 'The script address is printed escaped.' );
		$this->assertStringContainsString( '&lt;script&gt;alert(4)&lt;/script&gt;', $html, 'The agency name is printed escaped.' );
		$this->assertStringContainsString( '&lt;svg onload=alert(3)&gt;', $html, 'The language mapping is printed escaped.' );
	}

	/**
	 * The page has the settings form and the separate «Test connection» form, each with a nonce, and no field for a secret.
	 */
	public function test_page_has_two_forms_with_nonces_and_no_secret_field() {
		wp_set_current_user( $this->admin_id );
		$this->store( array( 'address' => 'https://prenota.example.com' ) );

		$html = $this->page_html();

		$this->assertStringContainsString( 'action="options.php"', $html );
		// WordPress prints this field with single quotes: any quote character is accepted here.
		$this->assertSame( 1, preg_match( '/name=.option_page.\s+value=.' . preg_quote( Settings::GROUP, '/' ) . './', $html ), 'The settings form carries its option page.' );
		$this->assertStringContainsString( 'admin-post.php?action=casazen_test_connection', $html );
		$this->assertStringContainsString( 'name="_wpnonce"', $html, 'The settings form has the nonce of the Settings API.' );
		$this->assertStringContainsString( 'name="' . Admin::NONCE_FIELD . '"', $html, 'The Test connection form has its own nonce.' );
		$this->assertStringNotContainsString( 'type="password"', $html );
		$this->assertSame( 0, preg_match( '/name="[^"]*(key|token|secret|password)[^"]*"/i', $html ), 'There is no field for a secret.' );
		$this->assertStringContainsString( 'name="casazen_settings[address]"', $html );
		$this->assertStringContainsString( 'name="casazen_settings[org_slug]"', $html );
		$this->assertStringContainsString( 'name="casazen_settings[language_map]"', $html );
		$this->assertStringContainsString( 'name="casazen_settings[load_script]"', $html );
	}

	/**
	 * The status box shows what the last test found, from the stored result, without any call.
	 */
	public function test_status_box_reads_the_stored_result() {
		wp_set_current_user( $this->admin_id );
		$this->store( array( 'address' => 'https://prenota.example.com' ) );
		$this->healthy_casazen();
		Connection::refresh();
		$this->requests = array();

		$html = $this->page_html();

		$this->assertSame( array(), $this->requests, 'Showing the page must not call CasaZen.' );
		$this->assertStringContainsString( 'Casa Rossi', $html );
		$this->assertStringContainsString( 'https://prenota.example.com/embed/v1/embed.js', $html );
		$this->assertStringContainsString( 'The connection works.', $html );
	}

	/**
	 * A user without manage_options cannot open the page.
	 */
	public function test_page_refuses_a_user_without_manage_options() {
		wp_set_current_user( $this->editor_id );

		$this->expectException( WPDieException::class );
		Admin::render_page();
	}

	/**
	 * The menu entry needs manage_options.
	 */
	public function test_menu_entry_needs_manage_options() {
		$this->assertSame( 'manage_options', Admin::CAPABILITY );

		$GLOBALS['submenu'] = array();
		wp_set_current_user( $this->admin_id );
		$hook = Admin::add_menu();
		$this->assertIsString( $hook );
		$this->assertStringContainsString( '_page_casazen', $hook );
		$found = false;
		foreach ( $GLOBALS['submenu']['options-general.php'] as $item ) {
			if ( 'casazen' === $item[2] ) {
				$found = true;
				$this->assertSame( 'manage_options', $item[1] );
				$this->assertFalse( user_can( $this->editor_id, $item[1] ) );
			}
		}
		$this->assertTrue( $found, 'The page is under Settings.' );
	}

	/**
	 * The notice «Set the CasaZen address» shows only on the plugin screen, only for who can manage options and only while
	 * there is no address.
	 */
	public function test_setup_notice_only_on_the_plugin_screen_and_for_admins() {
		delete_option( Settings::OPTION );

		wp_set_current_user( $this->admin_id );
		$hook = Admin::add_menu();
		set_current_screen( $hook );
		ob_start();
		Admin::maybe_show_setup_notice();
		$notice = (string) ob_get_clean();
		$this->assertStringContainsString( 'Set the CasaZen address', $notice );

		set_current_screen( 'dashboard' );
		ob_start();
		Admin::maybe_show_setup_notice();
		$this->assertSame( '', (string) ob_get_clean(), 'No notice on another screen.' );

		wp_set_current_user( $this->editor_id );
		set_current_screen( $hook );
		ob_start();
		Admin::maybe_show_setup_notice();
		$this->assertSame( '', (string) ob_get_clean(), 'No notice for a user who cannot manage options.' );

		wp_set_current_user( $this->admin_id );
		$this->store( array( 'address' => 'https://prenota.example.com' ) );
		set_current_screen( $hook );
		ob_start();
		Admin::maybe_show_setup_notice();
		$this->assertSame( '', (string) ob_get_clean(), 'No notice once the address is set.' );
	}

	/**
	 * The row of the plugin gets a «Settings» link.
	 */
	public function test_plugin_row_has_a_settings_link() {
		$links = Admin::plugin_action_links( array( 'deactivate' => '<a href="#">Deactivate</a>' ) );

		$this->assertCount( 2, $links );
		$this->assertStringContainsString( 'options-general.php?page=casazen', $links[0] );
		$this->assertStringContainsString( 'Settings', $links[0] );
		$this->assertSame( '<a href="#">Deactivate</a>', $links['deactivate'] );
	}

	/**
	 * The page prints a message for a known result code that the stored result confirms, and nothing for anything else.
	 */
	public function test_result_notice_only_shows_known_codes() {
		wp_set_current_user( $this->admin_id );
		$this->store( array( 'address' => 'https://prenota.example.com' ) );

		$this->store_result( 'ok' );
		$_GET['casazen_result'] = 'ok';
		$html                   = $this->page_html();
		$this->assertStringContainsString( 'notice-success', $html );
		$this->assertStringContainsString( 'The connection works.', $html );

		$this->store_result( 'embed_disabled' );
		$_GET['casazen_result'] = 'embed_disabled';
		$this->assertStringContainsString( 'notice-warning', $this->page_html() );

		$this->store_result( 'manifest_unreachable' );
		$_GET['casazen_result'] = 'manifest_unreachable';
		$this->assertStringContainsString( 'notice-error', $this->page_html() );

		foreach ( array( 'bogus', '<script>alert(1)</script>', array( 'ok' ) ) as $value ) {
			$_GET['casazen_result'] = $value;
			$html                   = $this->page_html();
			$this->assertStringNotContainsString( 'class="notice notice-', $html );
			$this->assertStringNotContainsString( 'alert(1)', $html );
		}
	}

	/**
	 * The code in the address of the page is only a pointer: the notice is printed only when the stored result says the same,
	 * so a link typed by hand, or the notice of an earlier test, never shows a success that the saved address does not have.
	 */
	public function test_result_notice_is_printed_only_when_the_stored_result_confirms_it() {
		wp_set_current_user( $this->admin_id );
		$this->store( array( 'address' => 'https://prenota.example.com' ) );

		// Nothing is stored for the address: no code can be confirmed.
		$_GET['casazen_result'] = 'ok';
		$html                   = $this->page_html();
		$this->assertStringNotContainsString( 'class="notice notice-', $html, 'A success that nothing stored must not be shown.' );
		$this->assertStringNotContainsString( 'The connection works.', $html );

		// A failure is stored: the success of an earlier test is not shown, the failure is.
		$this->store_result( 'manifest_unreachable' );
		$html = $this->page_html();
		$this->assertStringNotContainsString( 'class="notice notice-', $html, 'A success that the stored failure contradicts must not be shown.' );
		$this->assertStringNotContainsString( 'notice-success', $html );
		$this->assertStringNotContainsString( 'The connection works.', $html );

		$_GET['casazen_result'] = 'manifest_unreachable';
		$this->assertStringContainsString( 'notice-error', $this->page_html() );
	}

	/**
	 * A save of the settings brings back the address of the page, with the code of an earlier test in it: the page must not
	 * show that code as the outcome of the new settings.
	 */
	public function test_result_notice_is_not_printed_after_a_settings_save() {
		wp_set_current_user( $this->admin_id );
		$this->store( array( 'address' => 'https://prenota.example.com' ) );
		$this->store_result( 'ok' );

		$_GET['casazen_result'] = 'ok';
		$this->assertStringContainsString( 'notice-success', $this->page_html(), 'Right after the test the notice is printed.' );

		$_GET['settings-updated'] = 'true';
		$this->assertStringNotContainsString( 'class="notice notice-', $this->page_html(), 'After a save the earlier notice is not printed.' );
	}
}
