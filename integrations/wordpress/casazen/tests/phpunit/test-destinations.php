<?php
/**
 * Tests of the destinations of the search bar: read from a cache, never from the network during a request, and reduced to what
 * the search bar reads.
 *
 * Every HTTP call is stubbed with the `pre_http_request` filter: no test reaches the network.
 *
 * @package Casazen
 */

use Casazen\Connection;
use Casazen\Destinations;
use Casazen\Pages;
use Casazen\Settings;

/**
 * `Destinations` and the places the search element carries.
 */
class Test_Destinations extends WP_UnitTestCase {

	/**
	 * The requests the stub saw: url and arguments.
	 *
	 * @var array[]
	 */
	private $requests = array();

	/**
	 * What the stub answers: the part of the url to look for => the body (the status is 200).
	 *
	 * @var array
	 */
	private $replies = array();

	/**
	 * Installs the HTTP stub and the address.
	 */
	public function set_up() {
		parent::set_up();
		wp_set_current_user( 0 );
		$this->requests = array();
		$this->replies  = array();
		add_filter( 'pre_http_request', array( $this, 'fake_http' ), 10, 3 );
		$this->configure( array( 'address' => 'https://prenota.example.com' ) );
		wp_dequeue_script( 'casazen-embed' );
		wp_deregister_script( 'casazen-embed' );
	}

	/**
	 * The HTTP stub: records the request and answers from $this->replies.
	 *
	 * @param false|array|WP_Error $preempt The value so far.
	 * @param array                $args    The request arguments.
	 * @param string               $url     The address.
	 * @return array|WP_Error
	 */
	public function fake_http( $preempt, $args, $url ) {
		$this->requests[] = array(
			'url'  => $url,
			'args' => $args,
		);
		foreach ( $this->replies as $needle => $reply ) {
			if ( false === strpos( $url, (string) $needle ) ) {
				continue;
			}
			if ( $reply instanceof WP_Error ) {
				return $reply;
			}
			return array(
				'headers'  => array(),
				'cookies'  => array(),
				'filename' => null,
				'response' => array(
					'code'    => isset( $reply['status'] ) ? $reply['status'] : 200,
					'message' => 'x',
				),
				'body'     => isset( $reply['raw'] ) ? $reply['raw'] : wp_json_encode( $reply['json'] ),
			);
		}
		return new WP_Error( 'http_request_failed', 'No reply was prepared for ' . $url );
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
	 * Keeps a good connection result for the saved address.
	 *
	 * @param array $overrides Fields of the result to change.
	 */
	private function store_connection( array $overrides = array() ) {
		$settings = Settings::get();
		set_transient(
			Connection::cache_key( $settings['address'], $settings['org_slug'] ),
			array_merge(
				array(
					'ok'              => true,
					'code'            => 'ok',
					'agency'          => 'Casa Rossi',
					'slug'            => 'casa-rossi',
					'apiBase'         => 'https://api.example.com/api',
					'embedEnabled'    => true,
					'surfaces'        => null,
					'ownerLoginReady' => null,
					'checkedAt'       => time(),
				),
				$overrides
			),
			HOUR_IN_SECONDS
		);
	}

	/**
	 * Keeps a list for the saved address, as a refresh would.
	 *
	 * @param array $places The list.
	 */
	private function store_destinations( array $places ) {
		$settings = Settings::get();
		set_transient( Destinations::cache_key( $settings['address'], $settings['org_slug'] ), $places, HOUR_IN_SECONDS );
	}

	/**
	 * How many events of a hook are waiting in the cron array.
	 *
	 * @param string $hook The hook of the event.
	 * @return int
	 */
	private function count_events( $hook ) {
		$count = 0;
		foreach ( (array) _get_cron_array() as $hooks ) {
			if ( isset( $hooks[ $hook ] ) ) {
				$count += count( $hooks[ $hook ] );
			}
		}
		return $count;
	}

	/**
	 * The attribute of the first `<div>` of a markup.
	 *
	 * @param string $html The markup.
	 * @param string $name The attribute.
	 * @return string|null
	 */
	private function attribute( $html, $name ) {
		$processor = new WP_HTML_Tag_Processor( $html );
		if ( ! $processor->next_tag( 'div' ) ) {
			return null;
		}
		$value = $processor->get_attribute( $name );
		return is_string( $value ) ? $value : null;
	}

	/**
	 * Privacy and performance: a page with every widget and an empty cache makes no HTTP call, and schedules one event for the
	 * destinations (and one for the connection).
	 */
	public function test_render_never_calls_http() {
		$settings = Settings::get();
		$this->assertFalse( get_transient( Destinations::cache_key( $settings['address'], $settings['org_slug'] ) ) );
		$this->assertFalse( get_transient( Connection::cache_key( $settings['address'], $settings['org_slug'] ) ) );

		foreach ( array( '[casazen_booking]', '[casazen_property slug="villa-rossa"]', '[casazen_search]', '[casazen_search]', '[casazen_guest_access]', '[casazen_owner_login]' ) as $shortcode ) {
			do_shortcode( $shortcode );
		}

		$this->assertSame( array(), $this->requests, 'A request of a visitor never calls CasaZen.' );
		$this->assertSame( 1, $this->count_events( Destinations::CRON_EVENT ), 'One background event, whatever the number of search bars.' );
		$this->assertSame( 1, $this->count_events( 'casazen_refresh_connection' ) );
	}

	/**
	 * The search element carries the places only when the cache has some, as valid JSON, and never calls CasaZen.
	 */
	public function test_the_search_element_carries_the_places_only_when_the_cache_has_some() {
		$html = do_shortcode( '[casazen_search]' );
		$this->assertNull( $this->attribute( $html, 'data-casazen-destinations' ), 'Nothing cached: no attribute.' );

		$this->store_destinations( array() );
		$this->assertNull( $this->attribute( do_shortcode( '[casazen_search]' ), 'data-casazen-destinations' ), 'An empty list: no attribute.' );

		$this->store_destinations(
			array(
				array(
					'id'    => 'lugano',
					'label' => 'Lugano',
				),
				array(
					'id'    => 'como',
					'label' => 'Como',
				),
			)
		);
		$html = do_shortcode( '[casazen_search]' );
		$json = $this->attribute( $html, 'data-casazen-destinations' );
		$this->assertNotNull( $json );
		$this->assertSame(
			array(
				array(
					'id'    => 'lugano',
					'label' => 'Lugano',
				),
				array(
					'id'    => 'como',
					'label' => 'Como',
				),
			),
			json_decode( $json, true )
		);

		$this->assertNull( $this->attribute( do_shortcode( '[casazen_search destinations="no"]' ), 'data-casazen-destinations' ), 'destinations="no" switches them off.' );
		$this->assertNull( $this->attribute( do_shortcode( '[casazen_booking]' ), 'data-casazen-destinations' ), 'Only the search bar has places.' );
		$this->assertSame( array(), $this->requests );
	}

	/**
	 * The default target of the search bar is the page that has the role of the booking engine, else the home page.
	 */
	public function test_the_default_target_is_the_booking_page() {
		$this->assertSame( home_url( '/' ), $this->attribute( do_shortcode( '[casazen_search]' ), 'data-casazen-target' ) );

		$draft = self::factory()->post->create(
			array(
				'post_type'   => 'page',
				'post_status' => 'draft',
				'post_title'  => 'Prenota',
			)
		);
		update_post_meta( $draft, Pages::META_KEY, Pages::ROLE_BOOKING );
		$this->assertSame( home_url( '/' ), $this->attribute( do_shortcode( '[casazen_search]' ), 'data-casazen-target' ), 'A page that is not published does not count.' );

		$page = self::factory()->post->create(
			array(
				'post_type'   => 'page',
				'post_status' => 'publish',
				'post_title'  => 'Prenota',
				'post_name'   => 'prenota',
			)
		);
		update_post_meta( $page, Pages::META_KEY, Pages::ROLE_BOOKING );
		$this->assertSame( get_permalink( $page ), $this->attribute( do_shortcode( '[casazen_search]' ), 'data-casazen-target' ) );

		$this->assertSame( '/altra-pagina/', $this->attribute( do_shortcode( '[casazen_search target="/altra-pagina/"]' ), 'data-casazen-target' ), 'The attribute wins.' );
	}

	/**
	 * A refresh reads `GET <apiBase>/api/public/orgs/<slug>/destinations` with the limits of the connection test and keeps the
	 * list for 12 hours.
	 */
	public function test_refresh_reads_the_api_and_keeps_the_list() {
		if ( wp_using_ext_object_cache() ) {
			$this->markTestSkipped( 'The timeout of a transient is only in the options table without an external object cache.' );
		}
		$this->store_connection();
		$this->replies['/api/public/orgs/casa-rossi/destinations'] = array(
			'json' => array(
				array(
					'id'     => 'lugano',
					'label'  => 'Lugano',
					'comune' => 'Lugano',
					'count'  => 12,
				),
			),
		);

		$list = Destinations::refresh();

		$this->assertSame(
			array(
				array(
					'id'    => 'lugano',
					'label' => 'Lugano',
				),
			),
			$list,
			'Each place is reduced to its id and its label.'
		);
		$this->assertCount( 1, $this->requests );
		$this->assertSame( 'https://api.example.com/api/public/orgs/casa-rossi/destinations', $this->requests[0]['url'], 'The API address that already ends in /api is not doubled.' );
		$args = $this->requests[0]['args'];
		$this->assertSame( 5, $args['timeout'] );
		$this->assertSame( 2, $args['redirection'] );
		$this->assertSame( 65536, $args['limit_response_size'] );
		$this->assertTrue( $args['sslverify'] );

		$this->assertSame( $list, Destinations::for_search() );
		$this->assertCount( 1, $this->requests, 'Reading the cache calls nobody.' );

		$timeout = (int) get_option( '_transient_timeout_' . Destinations::cache_key( 'https://prenota.example.com', '' ) );
		$this->assertEqualsWithDelta( time() + 12 * HOUR_IN_SECONDS, $timeout, 10 );
	}

	/**
	 * An API address without `/api` (a bare host) works too, and the slug of the settings is used on the CasaZen domain.
	 */
	public function test_a_bare_api_host_and_the_org_slug_of_the_settings() {
		$this->configure(
			array(
				'address'  => 'https://casazen.example.org',
				'org_slug' => 'villa-azzurra',
			)
		);
		$this->store_connection(
			array(
				'slug'    => '',
				'apiBase' => 'https://api.example.com',
			)
		);
		$this->replies['/destinations'] = array(
			'json' => array(
				array(
					'id'    => 'como',
					'label' => 'Como',
				),
			),
		);

		Destinations::refresh();

		$this->assertSame( 'https://api.example.com/api/public/orgs/villa-azzurra/destinations', $this->requests[0]['url'] );
	}

	/**
	 * Each place keeps `id` and `label`: an id the search bar would not read is dropped and never rewritten, the label is cut and
	 * cleaned, and there are at most 200 places.
	 */
	public function test_the_list_is_reduced_to_valid_places() {
		$raw = array(
			array(
				'id'    => 'good-1',
				'label' => '  Lugano   centro ',
			),
			array(
				'id'    => 'bad id',
				'label' => 'A space in the id',
			),
			array(
				'id'    => 'Café',
				'label' => 'An accent in the id',
			),
			array(
				'id'    => '',
				'label' => 'No id',
			),
			array(
				'id'    => str_repeat( 'a', 101 ),
				'label' => 'An id of 101 characters',
			),
			array(
				'id'    => 'good-1',
				'label' => 'The same id again',
			),
			array(
				'id'    => 'dots.and_tilde~ok',
				'label' => str_repeat( 'x', 100 ),
			),
			array(
				'id'    => 'tags',
				'label' => '<b>Bold</b> place',
			),
			array(
				'id'    => 'empty-label',
				'label' => '  ',
			),
			array( 'id' => 'no-label' ),
			array(
				'id'    => 7,
				'label' => 'A number',
			),
			'a string',
			null,
		);

		$list = Destinations::clean_list( $raw );

		$this->assertSame(
			array(
				array(
					'id'    => 'good-1',
					'label' => 'Lugano centro',
				),
				array(
					'id'    => 'dots.and_tilde~ok',
					'label' => str_repeat( 'x', 80 ),
				),
				array(
					'id'    => 'tags',
					'label' => 'Bold place',
				),
			),
			$list
		);

		$many = array();
		for ( $i = 1; $i <= 250; $i++ ) {
			$many[] = array(
				'id'    => 'place-' . $i,
				'label' => 'Place ' . $i,
			);
		}
		$this->assertCount( 200, Destinations::clean_list( $many ) );
		$this->assertSame( array(), Destinations::clean_list( 'not a list' ) );
	}

	/**
	 * The JSON of the attribute keeps letters with accents as they are and stays below the limit of the search bar.
	 */
	public function test_the_json_fits_the_limit_of_the_search_bar() {
		$this->assertSame( '', Destinations::to_json( array() ) );

		$json = Destinations::to_json(
			array(
				array(
					'id'    => 'citta',
					'label' => 'Città di Lugano — “centro”',
				),
			)
		);
		$this->assertStringContainsString( 'Città di Lugano', $json, 'An accent is not written as an escape.' );
		$this->assertSame( 'Città di Lugano — “centro”', json_decode( $json, true )[0]['label'] );

		$many = array();
		for ( $i = 1; $i <= 200; $i++ ) {
			$many[] = array(
				'id'    => str_repeat( 'a', 90 ) . $i,
				'label' => str_repeat( 'è', 80 ),
			);
		}
		$json = Destinations::to_json( $many );
		$this->assertNotSame( '', $json );
		$this->assertLessThanOrEqual( 60000, strlen( $json ) );
		$this->assertCount( 200, json_decode( $json, true ) );

		// A label of control characters is written as escapes six characters long: the last places are left out until it fits.
		$heavy = array();
		for ( $i = 1; $i <= 200; $i++ ) {
			$heavy[] = array(
				'id'    => str_repeat( 'b', 90 ) . $i,
				'label' => str_repeat( "\x01", 80 ),
			);
		}
		$json = Destinations::to_json( $heavy );
		$this->assertNotSame( '', $json );
		$this->assertLessThanOrEqual( 60000, strlen( $json ) );
		$kept = json_decode( $json, true );
		$this->assertGreaterThan( 0, count( $kept ) );
		$this->assertLessThan( 200, count( $kept ) );
		$this->assertSame( 'b', substr( $kept[0]['id'], 0, 1 ), 'The first places stay.' );
	}

	/**
	 * A label with quotes and angle brackets stays inside its attribute: the attribute reads back as the JSON that was written.
	 */
	public function test_a_hostile_label_stays_inside_the_attribute() {
		$this->store_destinations(
			array(
				array(
					'id'    => 'quotes',
					'label' => 'He said "hi" \' <script>alert(1)</script> & more',
				),
			)
		);

		$html = do_shortcode( '[casazen_search]' );

		$this->assertStringNotContainsString( '<script', $html );
		// The value of the attribute runs up to the first double quote: a quote of the label that was not escaped would end it early.
		$this->assertSame( 1, preg_match( '/ data-casazen-destinations="([^"]*)"/', $html, $match ) );
		$this->assertStringNotContainsString( '<', $match[1] );
		$this->assertStringNotContainsString( "'", $match[1] );
		$json = html_entity_decode( $match[1], ENT_QUOTES | ENT_HTML5 );
		$this->assertSame( 'He said "hi" \' & more', json_decode( $json, true )[0]['label'] );
	}

	/**
	 * The refresh that follows a good connection test reads the destinations; a failed test does not.
	 */
	public function test_a_connection_refresh_triggers_a_destinations_refresh() {
		$this->store_connection();
		$this->replies['/destinations'] = array(
			'json' => array(
				array(
					'id'    => 'lugano',
					'label' => 'Lugano',
				),
			),
		);

		do_action(
			'casazen_connection_refreshed',
			array(
				'ok'   => false,
				'code' => 'manifest_unreachable',
			)
		);
		$this->assertSame( array(), $this->requests, 'A failed test reads nothing.' );

		do_action(
			'casazen_connection_refreshed',
			array(
				'ok'   => true,
				'code' => 'ok',
			)
		);
		$this->assertCount( 1, $this->requests );
		$this->assertSame( 'lugano', Destinations::for_search()[0]['id'] );
	}

	/**
	 * The background event runs the refresh.
	 */
	public function test_the_background_event_runs_the_refresh() {
		$this->store_connection();
		$this->replies['/destinations'] = array(
			'json' => array(
				array(
					'id'    => 'lugano',
					'label' => 'Lugano',
				),
			),
		);

		do_action( Destinations::CRON_EVENT );

		$this->assertCount( 1, $this->requests );
		$this->assertCount( 1, Destinations::for_search() );
	}

	/**
	 * A failure keeps an empty list for 15 minutes: the page does not schedule a new event for every visitor.
	 */
	public function test_a_failure_is_kept_for_fifteen_minutes() {
		if ( wp_using_ext_object_cache() ) {
			$this->markTestSkipped( 'The timeout of a transient is only in the options table without an external object cache.' );
		}
		$this->store_connection();
		$this->replies['/destinations'] = new WP_Error( 'http_request_failed', 'down' );

		$this->assertSame( array(), Destinations::refresh() );
		$this->assertSame( array(), Destinations::for_search() );

		$key = Destinations::cache_key( 'https://prenota.example.com', '' );
		$this->assertSame( array(), get_transient( $key ), 'An empty list, not a miss.' );
		$this->assertEqualsWithDelta( time() + 15 * MINUTE_IN_SECONDS, (int) get_option( '_transient_timeout_' . $key ), 10 );

		wp_clear_scheduled_hook( Destinations::CRON_EVENT );
		do_shortcode( '[casazen_search]' );
		$this->assertSame( 0, $this->count_events( Destinations::CRON_EVENT ), 'The failure is remembered: no new event.' );

		// Answers that are not a list, and a status that is not 200, are failures too.
		foreach ( array(
			array( 'raw' => 'not json' ),
			array(
				'status' => 500,
				'json'   => array(),
			),
			array(
				'status' => 404,
				'json'   => array(),
			),
		) as $reply ) {
			delete_transient( $key );
			$this->replies['/destinations'] = $reply;
			$this->assertSame( array(), Destinations::refresh() );
			$this->assertSame( array(), get_transient( $key ) );
			$this->assertLessThan( time() + HOUR_IN_SECONDS, (int) get_option( '_transient_timeout_' . $key ) );
		}
	}

	/**
	 * With no usable connection (nothing cached, or a failed test) nothing is asked and a short failure is kept.
	 */
	public function test_without_a_usable_connection_nothing_is_asked() {
		$this->assertSame( array(), Destinations::refresh() );
		$this->assertSame( array(), $this->requests );

		$this->store_connection(
			array(
				'ok'   => false,
				'code' => 'manifest_unreachable',
			)
		);
		$this->assertSame( array(), Destinations::refresh() );
		$this->assertSame( array(), $this->requests );

		$this->configure( array( 'address' => '' ) );
		$this->assertSame( array(), Destinations::refresh() );
		$this->assertSame( array(), Destinations::for_search() );
		$this->assertSame( array(), $this->requests );
	}

	/**
	 * What an object cache hands back is cleaned again when it is read.
	 */
	public function test_a_polluted_cache_is_cleaned_on_read() {
		$this->store_destinations(
			array(
				array(
					'id'    => 'ok',
					'label' => 'Fine',
				),
				array(
					'id'    => '"><script>',
					'label' => 'Not fine',
				),
			)
		);

		$this->assertSame(
			array(
				array(
					'id'    => 'ok',
					'label' => 'Fine',
				),
			),
			Destinations::for_search()
		);
	}
}
