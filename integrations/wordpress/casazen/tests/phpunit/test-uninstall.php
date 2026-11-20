<?php
/**
 * Tests of the uninstall script: it removes what the plugin stored, and only that.
 *
 * @package Casazen
 */

/**
 * `uninstall.php`.
 */
class Test_Uninstall extends WP_UnitTestCase {

	/**
	 * The names of the transients of the plugin that are still in the options table.
	 *
	 * @return string[]
	 */
	private function casazen_transient_rows() {
		global $wpdb;
		return $wpdb->get_col(
			$wpdb->prepare(
				"SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
				$wpdb->esc_like( '_transient_casazen_' ) . '%',
				$wpdb->esc_like( '_transient_timeout_casazen_' ) . '%'
			)
		);
	}

	/**
	 * Runs the uninstall script the way WordPress does.
	 */
	private function run_uninstall() {
		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			define( 'WP_UNINSTALL_PLUGIN', 'casazen/casazen.php' );
		}
		include CASAZEN_DIR . 'uninstall.php';
	}

	/**
	 * Fills the current site with what the plugin stores.
	 *
	 * @return int The id of a page of the guided setup.
	 */
	private function fill_the_site() {
		update_option( 'casazen_settings', array( 'address' => 'https://prenota.example.com' ) );
		update_option( 'casazen_wizard_state', array( 'step' => 2 ) );
		set_transient( 'casazen_conn_0123456789ab', array( 'ok' => true ), HOUR_IN_SECONDS );
		set_transient( 'casazen_other_thing', 'x', HOUR_IN_SECONDS );
		wp_clear_scheduled_hook( 'casazen_refresh_connection' );
		wp_schedule_single_event( time() + 600, 'casazen_refresh_connection' );

		$page_id = self::factory()->post->create(
			array(
				'post_type'   => 'page',
				'post_title'  => 'Prenota',
				'post_status' => 'publish',
			)
		);
		update_post_meta( $page_id, '_casazen_page_role', 'booking' );
		return $page_id;
	}

	/**
	 * The options, the transients and the events go; what belongs to others and the pages of the agency stay.
	 */
	public function test_uninstall_removes_everything_but_pages() {
		if ( wp_using_ext_object_cache() ) {
			$this->markTestSkipped( 'The transients are only in the options table without an external object cache.' );
		}
		$page_id = $this->fill_the_site();
		set_transient( 'other_plugin_cache', 'keep', HOUR_IN_SECONDS );
		update_option( 'other_plugin_option', 'keep' );
		update_option( 'casazen_unrelated_prefix_is_not_ours', 'keep' );
		$this->assertNotSame( array(), $this->casazen_transient_rows() );

		$this->run_uninstall();

		$this->assertFalse( get_option( 'casazen_settings' ) );
		$this->assertFalse( get_option( 'casazen_wizard_state' ) );
		$this->assertSame( array(), $this->casazen_transient_rows(), 'Every casazen_ transient and its timeout is gone.' );
		$this->assertFalse( wp_next_scheduled( 'casazen_refresh_connection' ) );

		$this->assertSame( 'keep', get_transient( 'other_plugin_cache' ), 'The transients of other plugins stay.' );
		$this->assertSame( 'keep', get_option( 'other_plugin_option' ) );
		$this->assertSame( 'keep', get_option( 'casazen_unrelated_prefix_is_not_ours' ), 'Only the options of the plugin are removed.' );

		$this->assertSame( 'page', get_post_type( $page_id ), 'The pages of the guided setup are the content of the agency.' );
		$this->assertSame( 'booking', get_post_meta( $page_id, '_casazen_page_role', true ) );
	}

	/**
	 * Every event of the hook goes, whatever its arguments.
	 */
	public function test_uninstall_removes_events_with_arguments_too() {
		wp_schedule_single_event( time() + 600, 'casazen_refresh_connection' );
		wp_schedule_single_event( time() + 900, 'casazen_refresh_connection', array( 'extra' ) );
		wp_schedule_single_event( time() + 900, 'another_plugin_event' );

		$this->run_uninstall();

		$left = array();
		foreach ( (array) _get_cron_array() as $hooks ) {
			$left = array_merge( $left, array_keys( $hooks ) );
		}
		$this->assertNotContains( 'casazen_refresh_connection', $left );
		$this->assertContains( 'another_plugin_event', $left );
	}

	/**
	 * On a network every site is cleaned.
	 */
	public function test_uninstall_covers_every_site_of_a_network() {
		if ( ! is_multisite() ) {
			$this->markTestSkipped( 'This test needs a network of sites.' );
		}
		if ( wp_using_ext_object_cache() ) {
			$this->markTestSkipped( 'The transients are only in the options table without an external object cache.' );
		}
		$first_page = $this->fill_the_site();

		$second_site = self::factory()->blog->create();
		switch_to_blog( $second_site );
		$second_page = $this->fill_the_site();
		restore_current_blog();

		$this->run_uninstall();

		$this->assertFalse( get_option( 'casazen_settings' ) );
		$this->assertSame( array(), $this->casazen_transient_rows() );
		$this->assertSame( 'page', get_post_type( $first_page ) );

		switch_to_blog( $second_site );
		$this->assertFalse( get_option( 'casazen_settings' ) );
		$this->assertFalse( get_option( 'casazen_wizard_state' ) );
		$this->assertSame( array(), $this->casazen_transient_rows() );
		$this->assertFalse( wp_next_scheduled( 'casazen_refresh_connection' ) );
		$this->assertSame( 'page', get_post_type( $second_page ), 'The pages of every site stay.' );
		restore_current_blog();
	}
}
