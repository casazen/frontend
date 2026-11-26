<?php
/**
 * Tests of the loader script: when it is put in the page, once, and with the attributes optimisation plugins respect.
 *
 * @package Casazen
 */

use Casazen\Assets;
use Casazen\Settings;

/**
 * `Assets::require_loader()` and the tag filter.
 */
class Test_Assets extends WP_UnitTestCase {

	/**
	 * Starts every test with no loader asked for, an address and the script switched on.
	 */
	public function set_up() {
		parent::set_up();
		wp_set_current_user( 0 );
		wp_dequeue_script( Assets::HANDLE );
		wp_deregister_script( Assets::HANDLE );
		$this->forget_printed_loader();
		$this->reset_late_flag();
		$this->configure( array( 'address' => 'https://prenota.example.com' ) );
	}

	/**
	 * Forgets that the loader was printed by an earlier test. The queue of WordPress lives as long as the request and keeps the
	 * handles it has printed in the list `done`: a loader that a test printed would make the next test see «already printed».
	 */
	private function forget_printed_loader() {
		$scripts       = wp_scripts();
		$scripts->done = array_values( array_diff( $scripts->done, array( Assets::HANDLE ) ) );
	}

	/**
	 * Forgets that a tag was printed by hand after the footer scripts (a property of the class that lives as long as the request).
	 */
	private function reset_late_flag() {
		$property = new ReflectionProperty( Assets::class, 'printed_late' );
		$property->setAccessible( true );
		$property->setValue( null, false );
	}

	/**
	 * Stores the settings without the hooks that run a refresh of the connection.
	 *
	 * @param array $values The values to change.
	 */
	private function configure( array $values ) {
		remove_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10 );
		remove_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10 );
		update_option( Settings::OPTION, array_merge( Settings::defaults(), $values ) );
		add_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10, 2 );
		add_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10, 2 );
	}

	/**
	 * Prints the footer scripts the way the theme does and returns what was printed.
	 *
	 * @return string
	 */
	private function print_footer() {
		ob_start();
		do_action( 'wp_print_footer_scripts' );
		return (string) ob_get_clean();
	}

	/**
	 * The loader is asked for by every widget that needs it and printed ONCE, with `defer` and the attributes of the optimisation
	 * plugins.
	 */
	public function test_loader_enqueued_once() {
		do_shortcode( '[casazen_booking]' );
		do_shortcode( '[casazen_booking]' );
		do_shortcode( '[casazen_property slug="villa-rossa"]' );
		do_shortcode( '[casazen_search]' );
		do_shortcode( '[casazen_guest_access]' );

		$this->assertTrue( wp_script_is( 'casazen-embed', 'enqueued' ) );

		$printed = $this->print_footer();
		$this->assertSame( 1, substr_count( $printed, 'casazen-embed-js' ), 'One tag, whatever the number of widgets.' );
		$this->assertSame( 1, preg_match( '#src=[\'"]https://prenota\.example\.com/embed/v1/embed\.js[\'"]#', $printed ), 'The loader of the saved address, with no version.' );
		$this->assertSame( 1, preg_match( '#<script[^>]*\sdefer[\s=>]#', $printed ), 'The tag keeps defer.' );
		foreach ( array( 'data-no-optimize="1"', 'data-no-defer="1"', 'data-no-minify="1"', 'data-cfasync="false"', 'data-wpfc-render="false"' ) as $attribute ) {
			$this->assertStringContainsString( $attribute, $printed );
		}
		$this->assertSame( 1, preg_match( '#<script[^>]*\sdata-pagespeed-no-defer[\s=>/]#', $printed ), 'An attribute without a value.' );
		$this->assertStringNotContainsString( 'search.js', $printed, 'The loader fetches the search bar by itself.' );
	}

	/**
	 * The owner link is not a widget the loader mounts: it does not ask for the script.
	 */
	public function test_the_owner_link_does_not_ask_for_the_loader() {
		do_shortcode( '[casazen_owner_login]' );

		$this->assertFalse( wp_script_is( 'casazen-embed', 'enqueued' ) );
		$this->assertStringNotContainsString( 'casazen-embed-js', $this->print_footer() );
	}

	/**
	 * Nothing is enqueued when the script is switched off in the settings, or when a widget prints nothing.
	 */
	public function test_no_loader_when_it_is_off_or_nothing_is_printed() {
		$this->configure(
			array(
				'address'     => 'https://prenota.example.com',
				'load_script' => false,
			)
		);
		$html = do_shortcode( '[casazen_booking]' );
		$this->assertStringContainsString( 'data-casazen-widget="booking"', $html, 'The element is still printed: the page may load the script by hand.' );
		$this->assertFalse( wp_script_is( 'casazen-embed', 'enqueued' ) );
		$this->assertStringNotContainsString( 'casazen-embed-js', $this->print_footer() );

		$this->configure( array( 'address' => '' ) );
		do_shortcode( '[casazen_booking]' );
		$this->assertFalse( wp_script_is( 'casazen-embed', 'enqueued' ) );

		$this->configure( array( 'address' => 'https://prenota.example.com' ) );
		do_shortcode( '[casazen_property]' );
		$this->assertFalse( wp_script_is( 'casazen-embed', 'enqueued' ), 'A property without a slug prints nothing and needs no script.' );
	}

	/**
	 * A widget printed after the footer scripts (too late for the queue) gets the tag once, there and then.
	 */
	public function test_a_widget_after_the_footer_scripts_gets_the_tag_once() {
		$this->print_footer();

		ob_start();
		do_shortcode( '[casazen_booking]' );
		do_shortcode( '[casazen_search]' );
		do_shortcode( '[casazen_guest_access]' );
		$printed = (string) ob_get_clean();

		$this->assertSame( 1, substr_count( $printed, '<script' ), 'One tag for three widgets.' );
		$this->assertSame( 1, preg_match( '#src=[\'"]https://prenota\.example\.com/embed/v1/embed\.js[\'"]#', $printed ) );
		$this->assertStringContainsString( 'id="casazen-embed-js"', $printed );
		$this->assertSame( 1, preg_match( '#<script[^>]*\sdefer[\s=>/]#', $printed ) );
		$this->assertStringContainsString( 'data-no-optimize="1"', $printed );
		$this->assertStringContainsString( 'data-cfasync="false"', $printed );
		$this->assertFalse( wp_script_is( 'casazen-embed', 'enqueued' ), 'Nothing is put in a queue that was already printed.' );
	}

	/**
	 * The page builder placeholder needs no loader.
	 */
	public function test_a_placeholder_needs_no_loader() {
		add_filter( 'casazen_render_placeholder', '__return_true' );

		do_shortcode( '[casazen_booking]' );

		$this->assertFalse( wp_script_is( 'casazen-embed', 'enqueued' ) );
	}

	/**
	 * The tag filter only touches the tag of the loader, and keeps the other attributes of the tag.
	 */
	public function test_the_tag_filter_only_touches_the_loader() {
		$tag = "<script src='https://prenota.example.com/embed/v1/embed.js' id='casazen-embed-js' defer data-wp-strategy='defer'></script>\n"; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- a string for the tag filter to work on, not a script of the page.

		$other = Assets::filter_tag( $tag, 'another-script' );
		$this->assertSame( $tag, $other );

		$changed = Assets::filter_tag( $tag, Assets::HANDLE );
		$this->assertStringContainsString( "src='https://prenota.example.com/embed/v1/embed.js'", $changed );
		$this->assertStringContainsString( 'defer', $changed );
		$this->assertStringContainsString( 'data-no-minify="1"', $changed );
		$this->assertStringContainsString( 'data-pagespeed-no-defer', $changed );

		// An inline script printed before the tag of the loader is left alone.
		$with_inline = "<script>window.x = 1;</script>\n" . $tag;
		$changed     = Assets::filter_tag( $with_inline, Assets::HANDLE );
		$this->assertStringStartsWith( '<script>window.x = 1;</script>', $changed );
		$this->assertSame( 1, substr_count( $changed, 'data-no-optimize' ) );
	}

	/**
	 * The loader URL is computed from the saved address.
	 */
	public function test_the_loader_url_comes_from_the_address() {
		$this->assertSame( 'https://prenota.example.com/embed/v1/embed.js', Assets::loader_url( 'https://prenota.example.com' ) );
		$this->assertSame( 'https://casazen.example.org:8443/embed/v1/embed.js', Assets::loader_url( 'https://casazen.example.org:8443' ) );
	}
}
