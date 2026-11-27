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
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- the test lists the rows that the uninstall must leave none of.
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

		// A default is passed: the setting is registered with a default of its own, which get_option() would return for a missing option.
		$this->assertSame( 'gone', get_option( 'casazen_settings', 'gone' ) );
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
	 * The places of the search bar (a transient) and the event that refreshes them go too.
	 */
	public function test_uninstall_removes_the_destinations_and_their_event() {
		if ( wp_using_ext_object_cache() ) {
			$this->markTestSkipped( 'The transients are only in the options table without an external object cache.' );
		}
		set_transient( 'casazen_destinations_0123456789ab', array( array( 'id' => 'lugano' ) ), HOUR_IN_SECONDS );
		wp_clear_scheduled_hook( 'casazen_refresh_destinations' );
		wp_schedule_single_event( time() + 600, 'casazen_refresh_destinations' );
		$this->assertNotFalse( wp_next_scheduled( 'casazen_refresh_destinations' ) );

		$this->run_uninstall();

		// The uninstall script deletes the rows with one query, as WordPress does when the plugin is deleted: the cache of this request is
		// not what it asserts.
		wp_cache_flush();
		$this->assertFalse( get_transient( 'casazen_destinations_0123456789ab' ) );
		$this->assertSame( array(), $this->casazen_transient_rows() );
		$this->assertFalse( wp_next_scheduled( 'casazen_refresh_destinations' ) );
	}

	/**
	 * The requests that the uninstall made, and what the stub answers to them.
	 *
	 * @var array[]
	 */
	private $uninstall_requests = array();

	/**
	 * Stubs the network: records each request and answers with the given reply.
	 *
	 * @param array|WP_Error $reply The answer of every request.
	 * @return void
	 */
	private function stub_network( $reply ) {
		$this->uninstall_requests = array();
		add_filter(
			'pre_http_request',
			function ( $preempt, $args, $url ) use ( $reply ) {
				unset( $preempt );
				$this->uninstall_requests[] = array(
					'url'  => $url,
					'args' => $args,
				);
				return $reply;
			},
			10,
			3
		);
	}

	/**
	 * Stores a connected site, as «Connect to CasaZen» leaves it, and the transients of the connection.
	 *
	 * @return void
	 */
	private function connect_the_site() {
		update_option(
			'casazen_link',
			array(
				'token'         => 'czs_UninstallTestCredential0123456789abcdefghi',
				'connection_id' => '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
				'org_slug'      => 'agenzia-esempio',
				'org_name'      => 'Agenzia Esempio',
				'site_url'      => 'https://example.org',
				'app_origin'    => 'https://www.casazen.space',
				'api_base'      => 'https://api.example.com/api',
				'connected_at'  => time(),
			),
			false
		);
		set_transient( 'casazen_account', array( 'org_name' => 'Agenzia Esempio' ), HOUR_IN_SECONDS );
		set_transient( 'casazen_connect_1', array( 'state' => 'x' ), HOUR_IN_SECONDS );
		set_transient( 'casazen_notice_1', array( 'text' => 'x' ), HOUR_IN_SECONDS );
	}

	/**
	 * AC 6: the uninstall gives the credential back to CasaZen (one DELETE, the credential only in its header, 10 seconds at most,
	 * no redirect) and removes the link and the transients of the connection.
	 */
	public function test_uninstall_gives_the_credential_back_and_removes_the_link() {
		if ( wp_using_ext_object_cache() ) {
			$this->markTestSkipped( 'The transients are only in the options table without an external object cache.' );
		}
		$this->connect_the_site();
		$this->stub_network(
			array(
				'headers'  => array(),
				'cookies'  => array(),
				'filename' => null,
				'response' => array(
					'code'    => 204,
					'message' => 'No Content',
				),
				'body'     => '',
			)
		);

		$this->run_uninstall();

		$this->assertCount( 1, $this->uninstall_requests );
		$request = $this->uninstall_requests[0];
		$this->assertSame( 'https://api.example.com/api/site/v1/connection', $request['url'] );
		$this->assertSame( 'DELETE', $request['args']['method'] );
		$this->assertSame( 'Bearer czs_UninstallTestCredential0123456789abcdefghi', $request['args']['headers']['Authorization'] );
		$this->assertLessThanOrEqual( 10, $request['args']['timeout'] );
		$this->assertSame( 0, $request['args']['redirection'] );
		$this->assertTrue( $request['args']['reject_unsafe_urls'] );

		$this->assertFalse( get_option( 'casazen_link' ) );
		$this->assertSame( array(), $this->casazen_transient_rows() );
	}

	/**
	 * AC 6: a CasaZen that does not answer never stops the uninstall: everything is removed all the same.
	 */
	public function test_an_unreachable_casazen_never_stops_the_uninstall() {
		if ( wp_using_ext_object_cache() ) {
			$this->markTestSkipped( 'The transients are only in the options table without an external object cache.' );
		}
		$this->connect_the_site();
		$this->stub_network( new WP_Error( 'http_request_failed', 'Operation timed out after 10000 milliseconds' ) );

		$this->run_uninstall();

		$this->assertCount( 1, $this->uninstall_requests );
		$this->assertFalse( get_option( 'casazen_link' ) );
		$this->assertSame( 'gone', get_option( 'casazen_settings', 'gone' ) );
		$this->assertSame( array(), $this->casazen_transient_rows() );
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

		$this->assertSame( 'gone', get_option( 'casazen_settings', 'gone' ) );
		$this->assertSame( array(), $this->casazen_transient_rows() );
		$this->assertSame( 'page', get_post_type( $first_page ) );

		switch_to_blog( $second_site );
		$this->assertSame( 'gone', get_option( 'casazen_settings', 'gone' ) );
		$this->assertFalse( get_option( 'casazen_wizard_state' ) );
		$this->assertSame( array(), $this->casazen_transient_rows() );
		$this->assertFalse( wp_next_scheduled( 'casazen_refresh_connection' ) );
		$this->assertSame( 'page', get_post_type( $second_page ), 'The pages of every site stay.' );
		restore_current_blog();
	}
}
