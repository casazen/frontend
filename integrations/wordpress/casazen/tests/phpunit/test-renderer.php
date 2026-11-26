<?php
/**
 * Tests of the renderer: the markup of each widget, the validation of every attribute and the cases where nothing is shown.
 *
 * @package Casazen
 */

use Casazen\Connection;
use Casazen\Renderer;
use Casazen\Settings;

/**
 * `Renderer::widget()`.
 */
class Test_Renderer extends WP_UnitTestCase {

	/**
	 * A user who can manage options.
	 *
	 * @var int
	 */
	private $admin_id = 0;

	/**
	 * The requests the HTTP recorder saw.
	 *
	 * @var string[]
	 */
	private $requests = array();

	/**
	 * Creates the user, an address and a recorder of HTTP requests (no test reaches the network).
	 */
	public function set_up() {
		parent::set_up();
		$this->admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$this->requests = array();
		wp_set_current_user( 0 );
		$this->configure( array( 'address' => 'https://prenota.example.com' ) );
		add_filter( 'pre_http_request', array( $this, 'record_http' ), 1, 3 );

		// The scripts of the page are global: a loader that an earlier test asked for must not count in this one.
		wp_dequeue_script( 'casazen-embed' );
		wp_deregister_script( 'casazen-embed' );
	}

	/**
	 * Records a request and lets the next filter (the one of the bootstrap) refuse it.
	 *
	 * @param false|array|WP_Error $preempt The value so far.
	 * @param array                $args    The request arguments.
	 * @param string               $url     The address.
	 * @return false|array|WP_Error
	 */
	public function record_http( $preempt, $args, $url ) {
		unset( $args );
		$this->requests[] = $url;
		return $preempt;
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
	 * Keeps a connection result for the saved address, as a test of the connection would.
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
					'apiBase'         => 'https://api.example.com',
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
	 * The attributes of the element that a markup starts with, read by the HTML processor of WordPress.
	 *
	 * @param string $html The markup of a widget.
	 * @return array|null name => value of the first `<div>`; null when there is none.
	 */
	private function div_attributes( $html ) {
		$processor = new WP_HTML_Tag_Processor( $html );
		if ( ! $processor->next_tag( 'div' ) ) {
			return null;
		}
		$attributes = array();
		foreach ( (array) $processor->get_attribute_names_with_prefix( '' ) as $name ) {
			$attributes[ $name ] = $processor->get_attribute( $name );
		}
		return $attributes;
	}

	/**
	 * The booking widget: one line, the attributes in the documented order, and the link for a browser without JavaScript.
	 */
	public function test_booking_markup_is_one_line_in_the_documented_order() {
		$html = do_shortcode( '[casazen_booking lang="en" checkin="2027-05-10" checkout="2027-05-14" guests="2" min_height="500" primary="#2b4c7e" radius="8px" font="moderno"]' );

		$expected = '<div class="casazen-widget casazen-widget--booking" data-casazen-widget="booking" data-casazen-base="https://prenota.example.com"'
			. ' data-casazen-lang="en" data-casazen-checkin="2027-05-10" data-casazen-checkout="2027-05-14" data-casazen-guests="2"'
			. ' data-casazen-datalayer="true" data-casazen-sync-url="false" data-casazen-min-height="500"'
			. ' data-casazen-theme="{&quot;primary&quot;:&quot;#2b4c7e&quot;,&quot;radius&quot;:&quot;8px&quot;,&quot;font&quot;:&quot;moderno&quot;}">'
			. '<noscript><a href="https://prenota.example.com/" rel="noopener">Book on prenota.example.com</a></noscript></div>';
		$this->assertSame( $expected, $html );
		$this->assertStringNotContainsString( "\n", $html );
		$this->assertStringNotContainsString( "\r", $html );
	}

	/**
	 * The organisation of the CasaZen domain goes in `data-casazen-org` and in the link of the browser without JavaScript.
	 */
	public function test_the_org_slug_and_the_property_widget() {
		$this->configure(
			array(
				'address'  => 'https://casazen.example.org',
				'org_slug' => 'casa-rossi',
			)
		);

		$html       = do_shortcode( '[casazen_property slug="villa-rossa" lang="it" datalayer="false" sync_url="yes"]' );
		$attributes = $this->div_attributes( $html );

		$this->assertSame( 'property', $attributes['data-casazen-widget'] );
		$this->assertSame( 'https://casazen.example.org', $attributes['data-casazen-base'] );
		$this->assertSame( 'casa-rossi', $attributes['data-casazen-org'] );
		$this->assertSame( 'it', $attributes['data-casazen-lang'] );
		$this->assertSame( 'villa-rossa', $attributes['data-casazen-property'] );
		$this->assertSame( 'false', $attributes['data-casazen-datalayer'] );
		$this->assertSame( 'true', $attributes['data-casazen-sync-url'] );
		$this->assertSame(
			array( 'data-casazen-widget', 'data-casazen-base', 'data-casazen-org', 'data-casazen-lang', 'data-casazen-property', 'data-casazen-datalayer', 'data-casazen-sync-url' ),
			array_values( array_diff( array_keys( $attributes ), array( 'class' ) ) ),
			'The attributes come in the documented order, and only those that have a value.'
		);
		$this->assertStringContainsString( 'href="https://casazen.example.org/book/casa-rossi/property/villa-rossa"', $html );
	}

	/**
	 * The guest access and the search bar carry only their own attributes.
	 */
	public function test_guest_access_and_search_carry_their_own_attributes() {
		$guest = $this->div_attributes( do_shortcode( '[casazen_guest_access lang="en" min_height="420" guests="3" checkin="2027-05-10"]' ) );
		$this->assertSame( 'guest-access', $guest['data-casazen-widget'] );
		$this->assertSame( '420', $guest['data-casazen-min-height'] );
		$this->assertArrayNotHasKey( 'data-casazen-guests', $guest, 'The guest access has no stay.' );
		$this->assertArrayNotHasKey( 'data-casazen-checkin', $guest );
		$this->assertArrayNotHasKey( 'data-casazen-sync-url', $guest );

		$search = $this->div_attributes( do_shortcode( '[casazen_search target="/prenota/" max_guests="8" min_height="420" guests="3"]' ) );
		$this->assertSame( 'search', $search['data-casazen-widget'] );
		$this->assertSame( '/prenota/', $search['data-casazen-target'] );
		$this->assertSame( '8', $search['data-casazen-max-guests'] );
		$this->assertArrayNotHasKey( 'data-casazen-min-height', $search, 'The search bar is not a frame.' );
		$this->assertArrayNotHasKey( 'data-casazen-guests', $search );
		$this->assertArrayNotHasKey( 'data-casazen-property', $search );
	}

	/**
	 * Each theme attribute is checked, and what is left is packed in ONE JSON object.
	 */
	public function test_the_theme_is_one_json_object_of_valid_members() {
		$theme = $this->div_attributes( do_shortcode( '[casazen_booking primary="#abc" radius="1rem"]' ) )['data-casazen-theme'];
		$this->assertSame(
			array(
				'primary' => '#abc',
				'radius'  => '1rem',
			),
			json_decode( $theme, true )
		);

		$attributes = $this->div_attributes( do_shortcode( '[casazen_booking primary="red" radius="40px" font="comic-sans"]' ) );
		$this->assertArrayNotHasKey( 'data-casazen-theme', $attributes, 'No valid member: no theme.' );

		$valid = array(
			'#fff',
			'#FFFFFF',
			'#2b4c7e',
		);
		foreach ( $valid as $color ) {
			$attributes = $this->div_attributes( Renderer::widget( 'booking', array( 'primary' => $color ) ) );
			$this->assertSame( array( 'primary' => $color ), json_decode( $attributes['data-casazen-theme'], true ), $color );
		}
		$refused = array( '#ff', '#ffff', '#gggggg', 'fff', 'rgb(0,0,0)', '#fff;x', 'javascript:alert(1)' );
		foreach ( $refused as $color ) {
			$attributes = $this->div_attributes( Renderer::widget( 'booking', array( 'primary' => $color ) ) );
			$this->assertArrayNotHasKey( 'data-casazen-theme', $attributes, $color );
		}

		$radius_valid   = array( '0px', '8px', '32px', '0rem', '2rem' );
		$radius_refused = array( '33px', '3rem', '8', '8em', 'px', '-1px', '1.5rem', '10 px' );
		foreach ( $radius_valid as $radius ) {
			$attributes = $this->div_attributes( Renderer::widget( 'booking', array( 'radius' => $radius ) ) );
			$this->assertSame( array( 'radius' => $radius ), json_decode( $attributes['data-casazen-theme'], true ), $radius );
		}
		foreach ( $radius_refused as $radius ) {
			$attributes = $this->div_attributes( Renderer::widget( 'booking', array( 'radius' => $radius ) ) );
			$this->assertArrayNotHasKey( 'data-casazen-theme', $attributes, $radius );
		}

		foreach ( array( 'editoriale', 'moderno', 'classico' ) as $font ) {
			$attributes = $this->div_attributes( Renderer::widget( 'booking', array( 'font' => $font ) ) );
			$this->assertSame( array( 'font' => $font ), json_decode( $attributes['data-casazen-theme'], true ), $font );
		}
	}

	/**
	 * An invalid date, number or colour falls back to its default, and an unknown attribute is ignored.
	 */
	public function test_invalid_values_fall_back_to_their_defaults() {
		$invalid    = array(
			'checkin'    => '2027-02-30',
			'checkout'   => '14/05/2027',
			'guests'     => '31',
			'min_height' => '99',
			'datalayer'  => 'maybe',
			'sync_url'   => 'perhaps',
			'lang'       => 'klingon',
			'unknown'    => 'x',
			'onclick'    => 'alert(1)',
		);
		$attributes = $this->div_attributes( Renderer::widget( 'booking', $invalid ) );

		$this->assertArrayNotHasKey( 'data-casazen-checkin', $attributes );
		$this->assertArrayNotHasKey( 'data-casazen-checkout', $attributes );
		$this->assertArrayNotHasKey( 'data-casazen-guests', $attributes );
		$this->assertArrayNotHasKey( 'data-casazen-min-height', $attributes );
		$this->assertArrayNotHasKey( 'data-casazen-unknown', $attributes );
		$this->assertArrayNotHasKey( 'onclick', $attributes );
		$this->assertSame( 'true', $attributes['data-casazen-datalayer'], 'The default of datalayer.' );
		$this->assertSame( 'false', $attributes['data-casazen-sync-url'], 'The default of sync_url.' );
		$this->assertContains( $attributes['data-casazen-lang'], array( 'it', 'en', 'auto' ) );

		$edges = array(
			array( 'guests', '1', '1' ),
			array( 'guests', '30', '30' ),
			array( 'guests', '0', null ),
			array( 'guests', '2.5', null ),
			array( 'guests', 3, '3' ),
			array( 'min_height', '100', '100' ),
			array( 'min_height', '2000', '2000' ),
			array( 'min_height', '2001', null ),
			array( 'checkin', '2028-02-29', '2028-02-29' ),
			array( 'checkin', '2027-02-29', null ),
			array( 'checkin', '2027-13-01', null ),
		);
		foreach ( $edges as $edge ) {
			$widget_attributes = $this->div_attributes( Renderer::widget( 'booking', array( $edge[0] => $edge[1] ) ) );
			$name              = 'data-casazen-' . str_replace( '_', '-', $edge[0] );
			if ( null === $edge[2] ) {
				$this->assertArrayNotHasKey( $name, $widget_attributes, $edge[0] . '=' . $edge[1] );
			} else {
				$this->assertSame( $edge[2], $widget_attributes[ $name ], $edge[0] . '=' . $edge[1] );
			}
		}
	}

	/**
	 * Security: a hostile value can not leave its HTML attribute, and no script reaches the page.
	 */
	public function test_hostile_attributes_stay_inside_the_attribute() {
		$hostile = '"><script>alert(1)</script>';

		$html = Renderer::widget(
			'booking',
			array(
				'lang'     => $hostile,
				'checkin'  => $hostile,
				'checkout' => $hostile,
				'guests'   => $hostile,
				'primary'  => $hostile,
				'radius'   => $hostile,
				'font'     => $hostile,
				'onload'   => $hostile,
			)
		);
		$this->assertStringNotContainsString( '<script', $html );
		$this->assertStringNotContainsString( 'onload', $html );

		// The same through the shortcode: a value that closes the attribute and opens another one is not a colour, a date or a size.
		$html = do_shortcode( "[casazen_booking primary='red;\" onmouseover=\"alert(1)' checkin='2027-01-01\" onfocus=\"alert(2)' font='x\"><b>']" );
		$this->assertStringContainsString( 'data-casazen-widget="booking"', $html );
		$this->assertStringNotContainsString( 'onmouseover', $html );
		$this->assertStringNotContainsString( 'onfocus', $html );
		$this->assertStringNotContainsString( '<b>', $html );
		$this->assertArrayNotHasKey( 'data-casazen-theme', (array) $this->div_attributes( $html ) );

		$html = Renderer::widget(
			'search',
			array(
				'target'       => 'https://example.com/' . $hostile,
				'destinations' => $hostile,
				'max_guests'   => $hostile,
			)
		);
		$this->assertStringNotContainsString( '<script', $html );
		$attributes = $this->div_attributes( $html );
		$this->assertNotNull( $attributes );
		$this->assertStringNotContainsString( 'alert(1)', (string) $attributes['data-casazen-target'], 'The hostile target was refused, not repaired.' );

		// A property slug is made of letters, digits and hyphens: anything else shows nothing and cannot break a page.
		$html = Renderer::widget( 'property', array( 'slug' => $hostile ) );
		$this->assertStringNotContainsString( '<script', $html );
		$this->assertStringNotContainsString( '<div', $html );

		// A label is text: it is escaped where it is printed.
		$html = Renderer::widget( 'owner-login', array( 'label' => '<img src=x onerror=alert(2)>Owners' ) );
		$this->assertStringNotContainsString( '<img', $html );
		$this->assertStringNotContainsString( 'onerror', $html );

		// A value that is valid but holds characters that matter in HTML (the JSON of the theme) is escaped in its attribute.
		$html = Renderer::widget( 'booking', array( 'primary' => '#2b4c7e' ) );
		$this->assertStringContainsString( 'data-casazen-theme="{&quot;primary&quot;:&quot;#2b4c7e&quot;}"', $html );
	}

	/**
	 * Security: a search target is a path of the site, an address of the site or an https address; nothing else.
	 */
	public function test_search_target_refuses_script_schemes() {
		$accepted = array(
			'/prenota/'                             => '/prenota/',
			'/prenota/?a=1&b=2#top'                 => '/prenota/?a=1&b=2#top',
			'https://other.example.org/it/search'   => 'https://other.example.org/it/search',
			'HTTPS://Other.Example.org/'            => 'HTTPS://Other.Example.org/',
			'https://prenota.example.com/book/casa' => 'https://prenota.example.com/book/casa',
			home_url( '/prenota/' )                 => home_url( '/prenota/' ),
		);
		foreach ( $accepted as $target => $expected ) {
			$this->assertSame( $expected, Renderer::sanitize_target( $target ), 'Accepted: ' . $target );
		}

		$refused = array(
			'javascript:alert(1)',
			'JaVaScRiPt:alert(1)',
			' javascript:alert(1)',
			"java\nscript:alert(1)",
			'data:text/html,<script>alert(1)</script>',
			'vbscript:msgbox(1)',
			'ftp://example.org/file',
			'file:///etc/passwd',
			'//evil.example.org/path',
			'/\\evil.example.org',
			'\\\\evil.example.org',
			'prenota/',
			'prenota.example.com',
			'http://evil.example.org/path',
			'https://user:secret@example.org/',
			'https://',
			'https://exa mple.org/',
			'https://example.org/"onmouseover="x',
			'https://example.org/<script>',
			'',
			'   ',
			'/' . str_repeat( 'a', 2100 ),
		);
		foreach ( $refused as $target ) {
			$this->assertSame( '', Renderer::sanitize_target( $target ), 'Refused: ' . $target );
		}
		$this->assertSame( '', Renderer::sanitize_target( array( '/prenota/' ) ) );
		$this->assertSame( '', Renderer::sanitize_target( null ) );

		// The element: a refused target gives the default one (the home of the site here, no page has the role of the booking engine).
		$attributes = $this->div_attributes( Renderer::widget( 'search', array( 'target' => 'javascript:alert(1)' ) ) );
		$this->assertSame( home_url( '/' ), $attributes['data-casazen-target'] );
	}

	/**
	 * Nothing is shown to visitors while the address is not set; administrators are told.
	 */
	public function test_an_empty_address_shows_a_notice_only_to_administrators() {
		$this->configure( array( 'address' => '' ) );

		foreach ( array( 'booking', 'property', 'search', 'guest-access', 'owner-login' ) as $widget ) {
			wp_set_current_user( 0 );
			$this->assertSame( '', Renderer::widget( $widget, array( 'slug' => 'villa-rossa' ) ), $widget . ' for a visitor.' );

			wp_set_current_user( $this->admin_id );
			$html = Renderer::widget( $widget, array( 'slug' => 'villa-rossa' ) );
			$this->assertStringContainsString( 'CasaZen: set the address in Settings → CasaZen', $html, $widget . ' for an administrator.' );
			$this->assertStringContainsString( 'dashed', $html );
			$this->assertStringNotContainsString( 'data-casazen-widget', $html );
		}
		$this->assertSame( array(), $this->requests );
	}

	/**
	 * Gating: embedding off hides the widgets from visitors (an HTML comment) and tells administrators; unknown shows the element.
	 * The owner link follows `surfaces.ownerPortal` instead.
	 */
	public function test_embed_disabled_hides_for_visitors() {
		$this->store_connection(
			array(
				'embedEnabled' => false,
				'code'         => 'embed_disabled',
			)
		);

		foreach ( array( 'booking', 'property', 'search', 'guest-access' ) as $widget ) {
			wp_set_current_user( 0 );
			$html = Renderer::widget( $widget, array( 'slug' => 'villa-rossa' ) );
			$this->assertStringContainsString( '<!--', $html, $widget );
			$this->assertStringNotContainsString( 'data-casazen-widget', $html, $widget );
			$this->assertStringNotContainsString( '<div', $html, $widget );
			$this->assertStringNotContainsString( 'embedding is not enabled', preg_replace( '/<!--.*?-->/s', '', $html ), 'Visitors see nothing but the comment.' );

			wp_set_current_user( $this->admin_id );
			$html = Renderer::widget( $widget, array( 'slug' => 'villa-rossa' ) );
			$this->assertStringContainsString( 'CasaZen: embedding is not enabled for this agency yet.', preg_replace( '/<!--.*?-->/s', '', $html ), $widget );
			$this->assertStringNotContainsString( 'data-casazen-widget', $html );
		}

		// The owner link is a link of the owner portal: embedding does not matter to it.
		wp_set_current_user( 0 );
		$this->assertStringContainsString( 'casazen-owner-login__link', Renderer::widget( 'owner-login' ) );

		// Not said by CasaZen (unknown): the element is printed.
		$this->store_connection( array( 'embedEnabled' => null ) );
		$this->assertStringContainsString( 'data-casazen-widget="booking"', Renderer::widget( 'booking' ) );

		// Said yes: the element is printed.
		$this->store_connection( array( 'embedEnabled' => true ) );
		$this->assertStringContainsString( 'data-casazen-widget="booking"', Renderer::widget( 'booking' ) );

		// Nothing cached yet (a miss): the element is printed and one event is scheduled, no request is made.
		delete_transient( Connection::cache_key( 'https://prenota.example.com', '' ) );
		$this->assertStringContainsString( 'data-casazen-widget="booking"', Renderer::widget( 'booking' ) );
		$this->assertSame( array(), $this->requests );
	}

	/**
	 * Gating: the owner link is not printed for visitors when the owner portal is off, and printed when it is on or unknown.
	 */
	public function test_the_owner_link_follows_the_owner_portal_surface() {
		$this->store_connection(
			array(
				'surfaces' => array(
					'guestArea'   => true,
					'ownerPortal' => false,
				),
			)
		);
		wp_set_current_user( 0 );
		$html = Renderer::widget( 'owner-login' );
		$this->assertStringNotContainsString( 'casazen-owner-login', $html );
		$this->assertStringNotContainsString( '<a ', $html );
		$this->assertStringContainsString( '<!--', $html );

		wp_set_current_user( $this->admin_id );
		$html = Renderer::widget( 'owner-login' );
		$this->assertStringNotContainsString( 'casazen-owner-login', $html );
		$this->assertStringContainsString( 'CasaZen: the owner portal is not enabled for this agency yet.', $html );

		wp_set_current_user( 0 );
		foreach ( array(
			null,
			array(
				'guestArea'   => false,
				'ownerPortal' => null,
			),
			array(
				'guestArea'   => false,
				'ownerPortal' => true,
			),
		) as $surfaces ) {
			$this->store_connection( array( 'surfaces' => $surfaces ) );
			$this->assertStringContainsString( 'casazen-owner-login__link', Renderer::widget( 'owner-login' ) );
		}
	}

	/**
	 * The owner link: one paragraph, a plain link to the sign-in of the owner area, never a frame.
	 */
	public function test_the_owner_link_markup() {
		$html = do_shortcode( '[casazen_owner_login]' );

		$this->assertSame(
			'<p class="casazen-owner-login"><a class="casazen-owner-login__link wp-element-button" href="https://prenota.example.com/portale-proprietari/accedi" rel="noopener">Owner area</a></p>',
			$html
		);
		$this->assertStringNotContainsString( 'iframe', $html );
		$this->assertStringNotContainsString( 'data-casazen', $html );

		$html = do_shortcode( '[casazen_owner_login label="Sign in, owners"]' );
		$this->assertStringContainsString( '>Sign in, owners</a>', $html );
	}

	/**
	 * A property widget needs a valid slug: without it nothing is printed (a comment for visitors, a notice for administrators).
	 */
	public function test_a_property_needs_a_valid_slug() {
		foreach ( array( '', 'Villa-Rossa', 'villa_rossa', '-villa', 'villa--rossa', str_repeat( 'a', 101 ) ) as $slug ) {
			wp_set_current_user( 0 );
			$html = Renderer::widget( 'property', array( 'slug' => $slug ) );
			$this->assertStringNotContainsString( '<div', $html, 'Slug: ' . $slug );
			$this->assertStringContainsString( '<!--', $html );

			wp_set_current_user( $this->admin_id );
			$this->assertStringContainsString( 'needs the slug of a property', Renderer::widget( 'property', array( 'slug' => $slug ) ) );
		}
		wp_set_current_user( 0 );
		$this->assertStringContainsString( 'data-casazen-property="villa-rossa-2"', Renderer::widget( 'property', array( 'slug' => 'villa-rossa-2' ) ) );
	}

	/**
	 * A page builder can ask for a static placeholder instead of the element; the loader is then not needed.
	 */
	public function test_the_placeholder_filter_replaces_the_element() {
		add_filter( 'casazen_render_placeholder', '__return_true' );

		$html = Renderer::widget( 'booking' );
		$this->assertStringContainsString( '<div class="casazen-placeholder">', $html );
		$this->assertStringContainsString( 'CasaZen — the booking engine appears on the published page', $html );
		$this->assertStringNotContainsString( 'data-casazen-widget', $html );
		$this->assertFalse( wp_script_is( 'casazen-embed', 'enqueued' ) );

		remove_filter( 'casazen_render_placeholder', '__return_true' );
		$this->assertStringContainsString( 'data-casazen-widget="booking"', Renderer::widget( 'booking' ) );
	}

	/**
	 * An unknown widget prints nothing; the attribute map lists the five widgets.
	 */
	public function test_unknown_widget_and_the_attribute_map() {
		$this->assertSame( '', Renderer::widget( 'unknown' ) );
		$this->assertSame( '', Renderer::widget( '' ) );

		$map = Renderer::attribute_map();
		$this->assertSame( array( 'booking', 'property', 'search', 'guest-access', 'owner-login' ), array_keys( $map ) );
		foreach ( $map as $attributes ) {
			foreach ( $attributes as $definition ) {
				$this->assertContains( $definition['type'], array( 'string', 'integer', 'boolean' ) );
				$this->assertArrayHasKey( 'default', $definition );
			}
		}
	}

	/**
	 * The language of a widget follows the attribute, then the page language and the mapping.
	 */
	public function test_the_language_attribute() {
		add_filter(
			'casazen_current_language',
			static function () {
				return 'en';
			}
		);
		$this->assertSame( 'en', $this->div_attributes( Renderer::widget( 'booking' ) )['data-casazen-lang'] );
		$this->assertSame( 'it', $this->div_attributes( Renderer::widget( 'booking', array( 'lang' => 'it' ) ) )['data-casazen-lang'] );
		$this->assertSame( 'auto', $this->div_attributes( Renderer::widget( 'guest-access', array( 'lang' => 'auto' ) ) )['data-casazen-lang'] );
	}
}
