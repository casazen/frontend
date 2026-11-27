<?php
/**
 * Tests of where the CasaZen console is: the constant of wp-config.php, the file of the published ZIP, the console of production.
 *
 * @package Casazen
 */

use Casazen\Build_Config;

/**
 * Build_Config.
 */
class Test_Build_Config extends WP_UnitTestCase {

	/**
	 * Files written by a test.
	 *
	 * @var string[]
	 */
	private $files = array();

	/**
	 * Removes the files a test wrote.
	 */
	public function tear_down() {
		foreach ( $this->files as $file ) {
			wp_delete_file( $file );
		}
		$this->files = array();
		parent::tear_down();
	}

	/**
	 * A file like the one tools/build-zip.mjs writes into the ZIP.
	 *
	 * @param string $body What the file returns, as PHP.
	 * @return string The path of the file.
	 */
	private function config_file( $body ) {
		$file = get_temp_dir() . 'casazen-build-config-' . wp_generate_password( 8, false ) . '.php';
		file_put_contents( $file, "<?php\ndefined( 'ABSPATH' ) || exit;\n\n" . $body . "\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- a temporary file of the test.
		$this->files[] = $file;
		return $file;
	}

	/**
	 * The constant wins, then the file of the ZIP, then the console of production; an address that is not valid is skipped.
	 */
	public function test_the_constant_then_the_file_then_production() {
		$file    = $this->config_file( "return array( 'app_origin' => 'https://casazen-test-app.vercel.app' );" );
		$missing = get_temp_dir() . 'casazen-no-such-file.php';

		$this->assertSame( 'https://staging.casazen.example', Build_Config::resolve( 'https://staging.casazen.example/', $file ) );
		$this->assertSame( 'https://casazen-test-app.vercel.app', Build_Config::resolve( null, $file ) );
		$this->assertSame( 'https://www.casazen.space', Build_Config::resolve( null, $missing ) );

		// A constant that is not a valid address is skipped: the file decides.
		foreach ( array( 'http://casazen.example', 'javascript:alert(1)', 'https://user:pass@casazen.example', '', 42 ) as $invalid ) {
			$this->assertSame( 'https://casazen-test-app.vercel.app', Build_Config::resolve( $invalid, $file ), (string) wp_json_encode( $invalid ) );
		}
		// http only for a development host.
		$this->assertSame( 'http://localhost:5173', Build_Config::resolve( 'http://localhost:5173', $missing ) );

		// A file that returns no valid address is skipped too.
		$this->assertSame( 'https://www.casazen.space', Build_Config::resolve( null, $this->config_file( "return array( 'app_origin' => 'http://evil.example' );" ) ) );
		$this->assertSame( 'https://www.casazen.space', Build_Config::resolve( null, $this->config_file( "return 'https://casazen.example';" ) ) );
	}

	/**
	 * The plugin in the repository has no file of the ZIP: without the constant it goes to the console of production.
	 */
	public function test_the_repository_has_no_file_of_the_zip() {
		$this->assertFileDoesNotExist( CASAZEN_DIR . Build_Config::FILE );
		if ( ! defined( Build_Config::CONSTANT ) ) {
			$this->assertSame( 'https://www.casazen.space', Build_Config::app_origin() );
		}
	}
}
