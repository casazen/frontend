<?php
/**
 * Tests of the settings: the address, the slug, the language mapping and the keys that are stored.
 *
 * @package Casazen
 */

use Casazen\Settings;

/**
 * The single option `casazen_settings` and its sanitisation.
 */
class Test_Settings extends WP_UnitTestCase {

	/**
	 * The Settings API functions live in the admin includes.
	 */
	public function set_up() {
		parent::set_up();
		require_once ABSPATH . 'wp-admin/includes/admin.php';
		$GLOBALS['wp_settings_errors'] = array();
	}

	/**
	 * Clears the errors the sanitisation reported.
	 */
	public function tear_down() {
		$GLOBALS['wp_settings_errors'] = array();
		parent::tear_down();
	}

	/**
	 * The error codes reported through the Settings API so far.
	 *
	 * @return string[]
	 */
	private function reported_codes() {
		return wp_list_pluck( get_settings_errors( Settings::OPTION ), 'code' );
	}

	/**
	 * Without an option the plugin has the defaults.
	 */
	public function test_defaults_when_the_option_is_missing() {
		delete_option( Settings::OPTION );

		$this->assertSame(
			array(
				'address'      => '',
				'org_slug'     => '',
				'language_map' => array(),
				'load_script'  => true,
			),
			Settings::get()
		);
	}

	/**
	 * The option is created with autoload off.
	 */
	public function test_option_is_created_without_autoload() {
		global $wpdb;
		delete_option( Settings::OPTION );

		Settings::install();

		$autoload = $wpdb->get_var( $wpdb->prepare( "SELECT autoload FROM {$wpdb->options} WHERE option_name = %s", Settings::OPTION ) );
		$this->assertContains( $autoload, array( 'no', 'off' ) );
		$this->assertSame( Settings::defaults(), get_option( Settings::OPTION ) );
	}

	/**
	 * Addresses that are accepted, reduced to scheme, host and port.
	 *
	 * @return array
	 */
	public static function provider_accepted_addresses() {
		return array(
			'plain https'               => array( 'https://prenota.example.com', 'https://prenota.example.com' ),
			'spaces around'             => array( "  https://prenota.example.com \n", 'https://prenota.example.com' ),
			'upper case'                => array( 'HTTPS://Prenota.Example.COM/', 'https://prenota.example.com' ),
			'path query and fragment'   => array( 'https://prenota.example.com/some/path/?a=1&b=2#frag', 'https://prenota.example.com' ),
			'markup in the path'        => array( 'https://x.example/"><script>alert(1)</script>', 'https://x.example' ),
			'port is kept'              => array( 'https://prenota.example.com:8443/x', 'https://prenota.example.com:8443' ),
			'default port is dropped'   => array( 'https://prenota.example.com:443', 'https://prenota.example.com' ),
			'http on localhost'         => array( 'http://localhost:5173/', 'http://localhost:5173' ),
			'http on 127.0.0.1'         => array( 'http://127.0.0.1:8080', 'http://127.0.0.1:8080' ),
			'http on a .test host'      => array( 'http://casazen.test', 'http://casazen.test' ),
			'http on a .localhost host' => array( 'http://shop.casazen.localhost:3000/a', 'http://shop.casazen.localhost:3000' ),
			'https on localhost'        => array( 'https://localhost', 'https://localhost' ),
			'empty is allowed'          => array( '', '' ),
			'only spaces'               => array( '   ', '' ),
		);
	}

	/**
	 * The address is reduced to its origin.
	 *
	 * @dataProvider provider_accepted_addresses
	 *
	 * @param string $typed    What the user typed.
	 * @param string $expected What is kept.
	 */
	public function test_address_is_reduced_to_its_origin( $typed, $expected ) {
		$this->assertSame( $expected, Settings::normalise_address( $typed ) );
	}

	/**
	 * Addresses that are refused, with the code of the reason.
	 *
	 * @return array
	 */
	public static function provider_refused_addresses() {
		return array(
			'javascript'                => array( 'javascript:alert(1)', 'address_scheme' ),
			'javascript upper case'     => array( 'JAVASCRIPT:alert(1)', 'address_scheme' ),
			'data'                      => array( 'data:text/html;base64,PHNjcmlwdD4=', 'address_scheme' ),
			'ftp'                       => array( 'ftp://prenota.example.com', 'address_scheme' ),
			'a bare host'               => array( 'prenota.example.com', 'address_scheme' ),
			'a bare path'               => array( '/just/a/path', 'address_scheme' ),
			'scheme relative'           => array( '//prenota.example.com', 'address_scheme' ),
			'user and password'         => array( 'https://user:pass@prenota.example.com', 'address_credentials' ),
			'user only'                 => array( 'https://user@prenota.example.com', 'address_credentials' ),
			'http on a real host'       => array( 'http://prenota.example.com', 'address_insecure' ),
			'localhost inside a name'   => array( 'http://localhost.example.com', 'address_insecure' ),
			'ends with localhost'       => array( 'http://evil-localhost', 'address_insecure' ),
			'no host'                   => array( 'https://', 'address_invalid' ),
			'a space inside'            => array( 'https://exa mple.com', 'address_invalid' ),
			'a label with a hyphen'     => array( 'https://-bad-.example.com', 'address_invalid' ),
			'a port out of range'       => array( 'https://prenota.example.com:99999', 'address_invalid' ),
			'an IPv6 literal'           => array( 'https://[::1]/', 'address_invalid' ),
			'a trailing dot'            => array( 'https://prenota.example.com.', 'address_invalid' ),
			'markup in the host'        => array( 'https://x"><script>.example', 'address_invalid' ),
			'not a string'              => array( array( 'https://prenota.example.com' ), 'address_invalid' ),
		);
	}

	/**
	 * Dangerous or wrong addresses are refused.
	 *
	 * @dataProvider provider_refused_addresses
	 *
	 * @param mixed  $typed What the user typed.
	 * @param string $code  The code of the reason.
	 */
	public function test_address_is_refused( $typed, $code ) {
		$result = Settings::normalise_address( $typed );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( $code, $result->get_error_code() );
	}

	/**
	 * A refused address is reported and the previous one stays.
	 */
	public function test_address_refused_keeps_the_previous_value_and_reports() {
		update_option( Settings::OPTION, array_merge( Settings::defaults(), array( 'address' => 'https://old.example.com' ) ) );

		$clean = Settings::sanitize( array( 'address' => 'javascript:alert(1)' ) );

		$this->assertSame( 'https://old.example.com', $clean['address'] );
		$this->assertSame( array( 'casazen_address' ), $this->reported_codes() );
	}

	/**
	 * An address that is typed correctly replaces the previous one and reports nothing.
	 */
	public function test_address_is_replaced_by_a_valid_one() {
		update_option( Settings::OPTION, array_merge( Settings::defaults(), array( 'address' => 'https://old.example.com' ) ) );

		$clean = Settings::sanitize( array( 'address' => 'https://new.example.com/path' ) );

		$this->assertSame( 'https://new.example.com', $clean['address'] );
		$this->assertSame( array(), $this->reported_codes() );
	}

	/**
	 * Slugs of the CasaZen domain.
	 *
	 * @return array
	 */
	public static function provider_slugs() {
		return array(
			'simple'              => array( 'casa-rossi', 'casa-rossi' ),
			'with hyphens'        => array( 'villa-rossi-2', 'villa-rossi-2' ),
			'upper case and room' => array( ' Villa-Rossi ', 'villa-rossi' ),
			'empty'               => array( '', '' ),
			'double hyphen'       => array( 'a--b', false ),
			'leading hyphen'      => array( '-a', false ),
			'trailing hyphen'     => array( 'a-', false ),
			'underscore'          => array( 'a_b', false ),
			'a space inside'      => array( 'a b', false ),
			'markup'              => array( '"><b>', false ),
			'100 characters'      => array( str_repeat( 'a', 100 ), str_repeat( 'a', 100 ) ),
			'101 characters'      => array( str_repeat( 'a', 101 ), false ),
			'not a string'        => array( array( 'a' ), false ),
		);
	}

	/**
	 * The organisation slug is optional and strict.
	 *
	 * @dataProvider provider_slugs
	 *
	 * @param mixed        $typed    What the user typed.
	 * @param string|false $expected The slug that is kept, or false when it is refused.
	 */
	public function test_org_slug( $typed, $expected ) {
		$this->assertSame( $expected, Settings::normalise_slug( $typed ) );
	}

	/**
	 * A refused slug is reported and the previous one stays.
	 */
	public function test_org_slug_refused_keeps_the_previous_value_and_reports() {
		update_option( Settings::OPTION, array_merge( Settings::defaults(), array( 'org_slug' => 'villa-rossi' ) ) );

		$clean = Settings::sanitize( array( 'org_slug' => 'Not A Slug!' ) );

		$this->assertSame( 'villa-rossi', $clean['org_slug'] );
		$this->assertSame( array( 'casazen_org_slug' ), $this->reported_codes() );
	}

	/**
	 * One line per language: code, equals sign, value.
	 */
	public function test_language_map_is_read_line_by_line() {
		$parsed = Settings::parse_language_map( "it_IT = it\r\nen = en\n\n  de = EN \nfr-FR=auto\npt = it\nen = auto" );

		$this->assertSame(
			array(
				'it_IT' => 'it',
				'en'    => 'auto',
				'de'    => 'en',
				'fr-FR' => 'auto',
				'pt'    => 'it',
			),
			$parsed['map']
		);
		$this->assertSame( array(), $parsed['rejected'] );
	}

	/**
	 * Invalid lines are dropped and reported.
	 */
	public function test_invalid_language_lines_are_dropped_and_reported() {
		$parsed = Settings::parse_language_map( "it = it\nnonsense\nde = fr\nx = en\n1234 = en\nen_US_POSIX_X = en" );

		$this->assertSame( array( 'it' => 'it' ), $parsed['map'] );
		$this->assertCount( 5, $parsed['rejected'] );

		$clean = Settings::sanitize( array( 'language_map' => "it = it\nnonsense" ) );
		$this->assertSame( array( 'it' => 'it' ), $clean['language_map'] );
		$this->assertSame( array( 'casazen_language_map' ), $this->reported_codes() );
	}

	/**
	 * What is reported about a bad line is escaped.
	 */
	public function test_reported_language_lines_are_escaped() {
		Settings::sanitize( array( 'language_map' => '<script>alert(1)</script>' ) );

		$errors = get_settings_errors( Settings::OPTION );
		$this->assertCount( 1, $errors );
		$this->assertStringNotContainsString( '<script>', $errors[0]['message'] );
		$this->assertStringContainsString( '&lt;script&gt;', $errors[0]['message'] );
	}

	/**
	 * The mapping is read again from what it stored (an array), so saving twice changes nothing.
	 */
	public function test_language_map_accepts_what_it_stored() {
		$parsed = Settings::parse_language_map( array( 'it_IT' => 'it', 'de' => 'en', 'xx' => 'nope' ) );

		$this->assertSame( array( 'it_IT' => 'it', 'de' => 'en' ), $parsed['map'] );
		$this->assertCount( 1, $parsed['rejected'] );
		$this->assertSame( "it_IT = it\nde = en", Settings::language_map_to_text( $parsed['map'] ) );
	}

	/**
	 * The script switch is a real boolean.
	 */
	public function test_load_script_is_a_bool() {
		foreach ( array( '1', 1, true, 'on', 'true' ) as $value ) {
			$clean = Settings::sanitize( array( 'load_script' => $value ) );
			$this->assertTrue( $clean['load_script'] );
		}
		foreach ( array( '0', 0, false, '', 'off', array() ) as $value ) {
			$clean = Settings::sanitize( array( 'load_script' => $value ) );
			$this->assertFalse( $clean['load_script'] );
		}
	}

	/**
	 * Only the four known keys are stored: nothing else gets in, and no secret has a place.
	 */
	public function test_only_known_keys_are_stored() {
		$clean = Settings::sanitize(
			array(
				'address'      => 'https://prenota.example.com',
				'org_slug'     => 'villa-rossi',
				'language_map' => 'it_IT = it',
				'load_script'  => '1',
				'api_key'      => 'sk_live_secret',
				'token'        => 'abc',
				'<b>x</b>'     => 'y',
			)
		);

		$keys = array_keys( $clean );
		sort( $keys );
		$this->assertSame( array( 'address', 'language_map', 'load_script', 'org_slug' ), $keys );
		$this->assertStringNotContainsString( 'sk_live_secret', wp_json_encode( $clean ) );

		// A value that was polluted in the database is read back as the four keys too.
		update_option( Settings::OPTION, array_merge( $clean, array( 'token' => 'abc', 'api_key' => 'sk_live_secret' ) ) );
		$keys = array_keys( Settings::get() );
		sort( $keys );
		$this->assertSame( array( 'address', 'language_map', 'load_script', 'org_slug' ), $keys );
	}

	/**
	 * Once the setting is registered, every write to the option goes through the sanitisation.
	 */
	public function test_the_registered_setting_sanitises_every_write() {
		Settings::register();

		update_option(
			Settings::OPTION,
			array(
				'address' => 'javascript:alert(1)',
				'token'   => 'abc',
			)
		);

		$stored = get_option( Settings::OPTION );
		$this->assertSame( '', $stored['address'] );
		$this->assertArrayNotHasKey( 'token', $stored );
	}

	/**
	 * A key that is not in the input keeps its previous value (the form always sends all four).
	 */
	public function test_a_missing_key_keeps_its_previous_value() {
		update_option(
			Settings::OPTION,
			array(
				'address'      => 'https://prenota.example.com',
				'org_slug'     => 'villa-rossi',
				'language_map' => array( 'de' => 'en' ),
				'load_script'  => false,
			)
		);

		$clean = Settings::sanitize( array( 'org_slug' => 'other' ) );

		$this->assertSame( 'https://prenota.example.com', $clean['address'] );
		$this->assertSame( 'other', $clean['org_slug'] );
		$this->assertSame( array( 'de' => 'en' ), $clean['language_map'] );
		$this->assertFalse( $clean['load_script'] );
	}

	/**
	 * A value that is not an array changes nothing.
	 */
	public function test_input_that_is_not_an_array_changes_nothing() {
		update_option( Settings::OPTION, array_merge( Settings::defaults(), array( 'address' => 'https://prenota.example.com' ) ) );

		$this->assertSame( Settings::get(), Settings::sanitize( 'not an array' ) );
	}

	/**
	 * Sanitising what was already sanitised changes nothing.
	 */
	public function test_sanitize_is_idempotent() {
		$once = Settings::sanitize(
			array(
				'address'      => ' HTTPS://Prenota.Example.com/x ',
				'org_slug'     => 'Villa-Rossi',
				'language_map' => "it_IT = it\nen = en\nbad",
				'load_script'  => '0',
			)
		);

		$this->assertSame( $once, Settings::sanitize( $once ) );
	}
}
