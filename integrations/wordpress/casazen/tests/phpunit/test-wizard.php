<?php
/**
 * Tests of the guided setup: the pages and the menu entries it creates, once, and what it never touches.
 *
 * @package Casazen
 */

use Casazen\Admin;
use Casazen\Connection;
use Casazen\Pages;
use Casazen\Settings;
use Casazen\Wizard;

/**
 * Thrown by the `wp_redirect` filter of the tests, so that the handler does not reach its `exit`.
 */
class Casazen_Test_Wizard_Redirect extends Exception {
}

/**
 * `Casazen\Wizard` and the tab «Guided setup».
 */
class Test_Wizard extends WP_UnitTestCase {

	/**
	 * A user who can do everything the form needs.
	 *
	 * @var int
	 */
	private $admin_id = 0;

	/**
	 * Starts every test as an administrator of a site with a good connection and no page.
	 */
	public function set_up() {
		parent::set_up();
		require_once ABSPATH . 'wp-admin/includes/admin.php';
		$this->admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		wp_set_current_user( $this->admin_id );
		$_REQUEST = array();
		$_GET     = array();
		$_POST    = array();

		// A new site has pages of its own (a sample page, a draft of the privacy policy): the tests count the pages, so they start
		// from a site with none.
		foreach ( get_posts(
			array(
				'post_type'   => 'page',
				'post_status' => 'any',
				'numberposts' => -1,
				'fields'      => 'ids',
			)
		) as $page_id ) {
			wp_delete_post( $page_id, true );
		}

		remove_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10 );
		remove_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10 );
		update_option( Settings::OPTION, array_merge( Settings::defaults(), array( 'address' => 'https://prenota.example.com' ) ) );
		add_action( 'add_option_' . Settings::OPTION, array( Settings::class, 'on_add' ), 10, 2 );
		add_action( 'update_option_' . Settings::OPTION, array( Settings::class, 'on_update' ), 10, 2 );
		$this->store_connection( true );
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
	 * Keeps a connection result for the saved address.
	 *
	 * @param bool $ok Whether the test of the connection worked.
	 */
	private function store_connection( $ok ) {
		$settings = Settings::get();
		set_transient(
			Connection::cache_key( $settings['address'], $settings['org_slug'] ),
			array(
				'ok'              => $ok,
				'code'            => $ok ? 'ok' : 'manifest_unreachable',
				'agency'          => 'Casa Rossi',
				'slug'            => 'casa-rossi',
				'apiBase'         => 'https://api.example.com/api',
				'embedEnabled'    => true,
				'surfaces'        => null,
				'ownerLoginReady' => null,
				'checkedAt'       => time(),
			),
			HOUR_IN_SECONDS
		);
	}

	/**
	 * Makes the filter that translates the strings of the plugin from its `.po` file, as the `.mo` of a release does.
	 *
	 * @param string $locale The locale the request speaks.
	 */
	private function speak_italian( $locale = 'it_IT' ) {
		add_filter(
			'determine_locale',
			static function () use ( $locale ) {
				return $locale;
			}
		);
		add_filter(
			'locale',
			static function () use ( $locale ) {
				return $locale;
			}
		);

		require_once ABSPATH . WPINC . '/pomo/po.php';
		$po = new PO();
		$this->assertTrue( $po->import_from_file( CASAZEN_DIR . 'languages/casazen-it_IT.po' ), 'The Italian translation is a valid .po file.' );
		add_filter(
			'gettext',
			static function ( $translation, $text, $domain ) use ( $po ) {
				if ( 'casazen' === $domain && isset( $po->entries[ $text ] ) && ! empty( $po->entries[ $text ]->translations[0] ) ) {
					return $po->entries[ $text ]->translations[0];
				}
				return $translation;
			},
			10,
			3
		);
	}

	/**
	 * The pages that carry a role, in any status.
	 *
	 * @return int[] Role => id (0 when there is none).
	 */
	private function role_pages() {
		$found = array();
		foreach ( Pages::roles() as $role ) {
			$found[ $role ] = Pages::find( $role, 'any' );
		}
		return $found;
	}

	/**
	 * How many pages exist, whatever they are.
	 *
	 * @return int
	 */
	private function count_pages() {
		return count(
			get_posts(
				array(
					'post_type'   => 'page',
					'post_status' => 'any',
					'numberposts' => -1,
					'fields'      => 'ids',
				)
			)
		);
	}

	/**
	 * Gives a page an old modification date, so that a change made by a later run shows.
	 *
	 * @param int $page_id The page.
	 */
	private function age( $page_id ) {
		global $wpdb;
		$wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- a test that fixes a date.
			$wpdb->posts,
			array(
				'post_modified'     => '2020-01-02 03:04:05',
				'post_modified_gmt' => '2020-01-02 03:04:05',
			),
			array( 'ID' => $page_id )
		);
		clean_post_cache( $page_id );
	}

	/**
	 * The state of a page, as a run could change it.
	 *
	 * @param int $page_id The page.
	 * @return array
	 */
	private function snapshot( $page_id ) {
		$post = get_post( $page_id );
		return array(
			'title'     => $post->post_title,
			'slug'      => $post->post_name,
			'content'   => $post->post_content,
			'status'    => $post->post_status,
			'modified'  => $post->post_modified,
			'author'    => $post->post_author,
			'parent'    => $post->post_parent,
			'role'      => get_post_meta( $page_id, Pages::META_KEY, true ),
			'permalink' => get_permalink( $page_id ),
		);
	}

	/**
	 * Posts the form as the browser would, with a nonce, and returns where the handler redirects to.
	 *
	 * @param array  $posted The `casazen_wizard` fields.
	 * @param string $nonce  The value of the nonce field, or null for none.
	 * @return string The address of the redirect.
	 */
	private function submit( array $posted, $nonce = '' ) {
		$_POST    = array( 'casazen_wizard' => wp_slash( $posted ) );
		$_REQUEST = $_POST;
		if ( '' === $nonce ) {
			$nonce = wp_create_nonce( Wizard::ACTION );
		}
		if ( null !== $nonce ) {
			$_POST[ Admin::NONCE_FIELD ]    = $nonce;
			$_REQUEST[ Admin::NONCE_FIELD ] = $nonce;
		}

		$catch = static function ( $location ) {
			throw new Casazen_Test_Wizard_Redirect( $location );
		};
		add_filter( 'wp_redirect', $catch );
		try {
			Wizard::handle_run();
		} catch ( Casazen_Test_Wizard_Redirect $redirect ) {
			return $redirect->getMessage();
		} finally {
			remove_filter( 'wp_redirect', $catch );
		}
		$this->fail( 'The handler was expected to redirect.' );
		return '';
	}

	/**
	 * Whether the handler refuses a request (it stops with `wp_die`).
	 *
	 * @param array  $posted The fields.
	 * @param string $nonce  The nonce, '' for a good one, null for none.
	 * @return bool
	 */
	private function is_refused( array $posted, $nonce = '' ) {
		try {
			$this->submit( $posted, $nonce );
		} catch ( WPDieException $die ) {
			return true;
		}
		return false;
	}

	/**
	 * The posted fields for a run with the defaults of the form.
	 *
	 * @param array $overrides Fields to change.
	 * @return array
	 */
	private function form( array $overrides = array() ) {
		$titles = Wizard::default_titles();
		$form   = array(
			'pages'   => array(),
			'publish' => '1',
			'menu'    => '0',
		);
		foreach ( Pages::roles() as $role ) {
			$form['pages'][ $role ] = array(
				'enabled' => '1',
				'title'   => $titles[ $role ],
			);
		}
		return array_merge( $form, $overrides );
	}

	/**
	 * Permission: the form refuses a user without the capabilities and a request with a bad nonce.
	 */
	public function test_run_requires_capability_and_nonce() {
		// An editor can publish pages but cannot manage options: refused, even with a good nonce.
		$editor = self::factory()->user->create( array( 'role' => 'editor' ) );
		wp_set_current_user( $editor );
		$this->assertTrue( $this->is_refused( $this->form() ), 'A user without manage_options is refused.' );

		// A user who can manage options but not publish pages is refused too.
		add_role( 'casazen_options_only', 'Options only', array( 'manage_options' => true ) );
		$options_only = self::factory()->user->create( array( 'role' => 'casazen_options_only' ) );
		wp_set_current_user( $options_only );
		$this->assertTrue( $this->is_refused( $this->form() ), 'A user without publish_pages is refused.' );
		remove_role( 'casazen_options_only' );

		// A user who can do both but cannot edit the menus is refused when a menu is chosen, and accepted when none is.
		add_role(
			'casazen_no_menus',
			'No menus',
			array(
				'manage_options' => true,
				'publish_pages'  => true,
				'edit_pages'     => true,
				'read'           => true,
			)
		);
		$no_menus = self::factory()->user->create( array( 'role' => 'casazen_no_menus' ) );
		wp_set_current_user( $no_menus );
		$menu_id = wp_create_nav_menu( 'Main' );
		$this->assertTrue( $this->is_refused( $this->form( array( 'menu' => (string) $menu_id ) ) ), 'A menu needs edit_theme_options.' );
		$this->assertSame( 0, $this->count_pages(), 'Nothing was created.' );
		remove_role( 'casazen_no_menus' );

		// An administrator with a nonce that is wrong, missing or made for another form is refused.
		wp_set_current_user( $this->admin_id );
		foreach ( array(
			'a wrong nonce'           => 'not-a-nonce',
			'a nonce of another form' => wp_create_nonce( 'something-else' ),
			'no nonce'                => null,
		) as $label => $nonce ) {
			$this->assertTrue( $this->is_refused( $this->form(), $nonce ), 'A request with ' . $label . ' is refused.' );
			$this->assertSame( 0, $this->count_pages(), 'Nothing is created for ' . $label . '.' );
		}

		// A good nonce: the pages are created and the answer is a redirect to the tab.
		$location = $this->submit( $this->form() );
		$query    = array();
		parse_str( (string) wp_parse_url( $location, PHP_URL_QUERY ), $query );
		$this->assertSame(
			array(
				'page' => 'casazen',
				'tab'  => 'setup',
			),
			$query
		);
		$this->assertStringContainsString( 'options-general.php', $location );
		$this->assertSame( 3, $this->count_pages() );
	}

	/**
	 * The gate: without a good connection nothing is created, and the form says to run the test first.
	 */
	public function test_the_form_needs_a_connection_that_works() {
		$this->store_connection( false );

		$this->submit( $this->form() );

		$this->assertSame( 0, $this->count_pages() );
		$result = Wizard::take_result();
		$this->assertFalse( $result['ok'] );
		$this->assertSame( 'not_connected', $result['error'] );

		delete_transient( Connection::cache_key( 'https://prenota.example.com', '' ) );
		$this->submit( $this->form() );
		$this->assertSame( 0, $this->count_pages(), 'A connection that was never tested is not a good one.' );

		// The tab shows the message instead of the form.
		$_GET['tab'] = 'setup';
		ob_start();
		Admin::render_page();
		$html = (string) ob_get_clean();
		$this->assertStringContainsString( 'Run the connection test first', $html );
		$this->assertStringNotContainsString( 'name="casazen_wizard', $html );
		$this->assertStringNotContainsString( 'action=casazen_run_wizard', $html );

		// A connection that works but says embedding is off is still a connection: the setup does not depend on the SiteEmbed flag.
		set_transient(
			Connection::cache_key( 'https://prenota.example.com', '' ),
			array(
				'ok'              => true,
				'code'            => 'embed_disabled',
				'agency'          => 'Casa Rossi',
				'slug'            => 'casa-rossi',
				'apiBase'         => 'https://api.example.com/api',
				'embedEnabled'    => false,
				'surfaces'        => null,
				'ownerLoginReady' => null,
				'checkedAt'       => time(),
			),
			HOUR_IN_SECONDS
		);
		$this->submit( $this->form() );
		$this->assertSame( 3, $this->count_pages() );
	}

	/**
	 * Data: the pages are created with their role, a shortcode block, closed comments and the current user as author.
	 */
	public function test_pages_are_created_with_their_role_and_content() {
		$result = Wizard::run( $this->form() );

		$this->assertTrue( $result['ok'] );
		$expected = array(
			Pages::ROLE_BOOKING      => '[casazen_booking]',
			Pages::ROLE_GUEST_ACCESS => '[casazen_guest_access]',
			Pages::ROLE_OWNER_AREA   => '[casazen_owner_login]',
		);
		foreach ( $expected as $role => $shortcode ) {
			$this->assertSame( 'created', $result['pages'][ $role ]['status'], $role );
			$page = get_post( $result['pages'][ $role ]['id'] );
			$this->assertSame( 'page', $page->post_type );
			$this->assertSame( 'publish', $page->post_status );
			$this->assertSame( '<!-- wp:shortcode -->' . $shortcode . '<!-- /wp:shortcode -->', $page->post_content );
			$this->assertSame( $role, get_post_meta( $page->ID, Pages::META_KEY, true ) );
			$this->assertSame( 'closed', $page->comment_status );
			$this->assertSame( 'closed', $page->ping_status );
			$this->assertSame( (string) $this->admin_id, $page->post_author );
			$this->assertSame( $page->post_name, $result['pages'][ $role ]['slug'] );
			$this->assertSame( get_permalink( $page ), $result['pages'][ $role ]['url'] );
		}
		$this->assertSame( 'book', get_post( $result['pages'][ Pages::ROLE_BOOKING ]['id'] )->post_name );
		$this->assertSame( 'online-check-in', get_post( $result['pages'][ Pages::ROLE_GUEST_ACCESS ]['id'] )->post_name );
		$this->assertSame( 'owner-area', get_post( $result['pages'][ Pages::ROLE_OWNER_AREA ]['id'] )->post_name );
		$this->assertSame( 3, $this->count_pages() );

		// The shortcode blocks render the widgets: the page of the booking engine holds the booking widget.
		$content = apply_filters( 'the_content', get_post( $result['pages'][ Pages::ROLE_BOOKING ]['id'] )->post_content );
		$this->assertStringContainsString( 'data-casazen-widget="booking"', $content );
		$this->assertSame( $result['pages'][ Pages::ROLE_BOOKING ]['url'], Pages::url_for_role( Pages::ROLE_BOOKING ) );

		// The filter may change the content of a page.
		wp_delete_post( $result['pages'][ Pages::ROLE_OWNER_AREA ]['id'], true );
		add_filter(
			'casazen_wizard_page_content',
			static function ( $content, $role ) {
				return Pages::ROLE_OWNER_AREA === $role ? '[casazen_owner_login label="Sign in"]' : $content;
			},
			10,
			2
		);
		$again = Wizard::run( $this->form() );
		$this->assertSame( 'created', $again['pages'][ Pages::ROLE_OWNER_AREA ]['status'] );
		$this->assertSame( 'exists', $again['pages'][ Pages::ROLE_BOOKING ]['status'] );
		$this->assertSame( '[casazen_owner_login label="Sign in"]', get_post( $again['pages'][ Pages::ROLE_OWNER_AREA ]['id'] )->post_content );
	}

	/**
	 * Data: running twice creates no page and no menu item and leaves the existing pages exactly as they were (AC-NF148-4).
	 */
	public function test_second_run_changes_nothing() {
		$menu_id = wp_create_nav_menu( 'Main' );
		$choices = $this->form( array( 'menu' => (string) $menu_id ) );

		$first = Wizard::run( $choices );
		$this->assertSame( 'created', $first['pages'][ Pages::ROLE_BOOKING ]['status'] );
		$ids = array();
		foreach ( Pages::roles() as $role ) {
			$ids[ $role ] = $first['pages'][ $role ]['id'];
			$this->age( $ids[ $role ] );
		}
		$before = array();
		foreach ( $ids as $role => $page_id ) {
			$before[ $role ] = $this->snapshot( $page_id );
		}
		$items_before = wp_get_nav_menu_items( $menu_id );
		$this->assertCount( 3, $items_before );
		$item_ids_before = wp_list_pluck( $items_before, 'ID' );
		$pages_before    = $this->count_pages();

		$second = Wizard::run( $choices );

		foreach ( Pages::roles() as $role ) {
			$this->assertSame( 'exists', $second['pages'][ $role ]['status'], $role );
			$this->assertSame( $ids[ $role ], $second['pages'][ $role ]['id'], 'The same page.' );
			$this->assertSame( $before[ $role ], $this->snapshot( $ids[ $role ] ), 'The page ' . $role . ' did not change.' );
			$this->assertSame( '2020-01-02 03:04:05', get_post( $ids[ $role ] )->post_modified, 'post_modified stays as it was.' );
			$this->assertSame( 'exists', $second['menu']['items'][ $role ] );
		}
		$this->assertSame( $pages_before, $this->count_pages(), 'No new page.' );
		$this->assertSame( $item_ids_before, wp_list_pluck( wp_get_nav_menu_items( $menu_id ), 'ID' ), 'No new and no changed menu item.' );
		$this->assertSame( $this->role_pages(), $ids );

		// The titles, the box «publish» and the other choices of the second run do not matter either.
		$other  = $this->form(
			array(
				'publish' => '',
				'menu'    => (string) $menu_id,
			)
		);
		$other['pages'][ Pages::ROLE_BOOKING ]['title'] = 'Something else';
		$third = Wizard::run( $other );
		$this->assertSame( 'exists', $third['pages'][ Pages::ROLE_BOOKING ]['status'] );
		$this->assertSame( $before[ Pages::ROLE_BOOKING ], $this->snapshot( $ids[ Pages::ROLE_BOOKING ] ) );
	}

	/**
	 * A page that exists in any status but trash, in any language, counts as done: a draft, a private page, a pending one.
	 */
	public function test_a_page_of_any_status_but_trash_counts() {
		foreach ( array( 'draft', 'private', 'pending', 'future' ) as $status ) {
			$page_id = self::factory()->post->create(
				array(
					'post_type'   => 'page',
					'post_status' => $status,
					'post_title'  => 'My ' . $status . ' booking page',
					'post_date'   => 'future' === $status ? gmdate( 'Y-m-d H:i:s', time() + DAY_IN_SECONDS ) : current_time( 'mysql' ),
				)
			);
			update_post_meta( $page_id, Pages::META_KEY, Pages::ROLE_BOOKING );

			$result = Wizard::run( $this->form() );

			$this->assertSame( 'exists', $result['pages'][ Pages::ROLE_BOOKING ]['status'], $status );
			$this->assertSame( $page_id, $result['pages'][ Pages::ROLE_BOOKING ]['id'], $status );
			$this->assertSame( $status, get_post( $page_id )->post_status, 'The status of ' . $status . ' did not change.' );
			wp_delete_post( $page_id, true );
			foreach ( Pages::roles() as $role ) {
				$id = Pages::find( $role, 'any' );
				if ( $id ) {
					wp_delete_post( $id, true );
				}
			}
		}

		// A page in the trash is gone: a new one is made.
		$trashed = self::factory()->post->create(
			array(
				'post_type'   => 'page',
				'post_status' => 'publish',
				'post_title'  => 'Trashed',
			)
		);
		update_post_meta( $trashed, Pages::META_KEY, Pages::ROLE_BOOKING );
		wp_trash_post( $trashed );

		$result = Wizard::run( $this->form() );

		$this->assertSame( 'created', $result['pages'][ Pages::ROLE_BOOKING ]['status'] );
		$this->assertNotSame( $trashed, $result['pages'][ Pages::ROLE_BOOKING ]['id'] );
		$this->assertSame( 'trash', get_post( $trashed )->post_status, 'The trashed page is left in the trash.' );
	}

	/**
	 * Data: a page with the same slug but no role is never adopted and never overwritten; the new page takes the next free slug.
	 */
	public function test_foreign_page_with_same_slug_is_left_alone() {
		$foreign = self::factory()->post->create(
			array(
				'post_type'    => 'page',
				'post_status'  => 'publish',
				'post_title'   => 'Book',
				'post_name'    => 'book',
				'post_content' => 'The page of somebody else.',
			)
		);
		$this->age( $foreign );
		$before = $this->snapshot( $foreign );

		$result = Wizard::run( $this->form() );

		$page = $result['pages'][ Pages::ROLE_BOOKING ];
		$this->assertSame( 'created', $page['status'] );
		$this->assertNotSame( $foreign, $page['id'], 'The page of somebody else is not adopted.' );
		$this->assertSame( 'book-2', $page['slug'], 'The new page takes the next free slug.' );
		$this->assertSame( 'book', $page['wanted_slug'], 'The result says which slug was wanted.' );
		$this->assertSame( $before, $this->snapshot( $foreign ), 'The foreign page did not change.' );
		$this->assertSame( '', get_post_meta( $foreign, Pages::META_KEY, true ), 'The foreign page got no role.' );
		$this->assertSame( 'The page of somebody else.', get_post( $foreign )->post_content );

		// The same for drafts: a draft would keep any slug it is given, so the free slug is worked out as for a published page.
		wp_delete_post( $page['id'], true );
		$result = Wizard::run( $this->form( array( 'publish' => '' ) ) );
		$this->assertSame( 'draft', get_post( $result['pages'][ Pages::ROLE_BOOKING ]['id'] )->post_status );
		$this->assertSame( 'book-2', $result['pages'][ Pages::ROLE_BOOKING ]['slug'] );
		$this->assertSame( $before, $this->snapshot( $foreign ) );
	}

	/**
	 * Data: the entries of a menu that exist stay as they were; the pages are added at the end, once.
	 */
	public function test_existing_menu_items_untouched() {
		$menu_id = wp_create_nav_menu( 'Main menu' );
		$home    = wp_update_nav_menu_item(
			$menu_id,
			0,
			array(
				'menu-item-type'     => 'custom',
				'menu-item-url'      => 'https://example.org/',
				'menu-item-title'    => 'Home',
				'menu-item-status'   => 'publish',
				'menu-item-position' => 1,
			)
		);
		$blog = wp_update_nav_menu_item(
			$menu_id,
			0,
			array(
				'menu-item-type'     => 'custom',
				'menu-item-url'      => 'https://example.org/blog/',
				'menu-item-title'    => 'Our blog',
				'menu-item-status'   => 'publish',
				'menu-item-position' => 7,
			)
		);

		// The guest page already exists and the owner of the site had put it in the menu by hand, between the others.
		$guest = self::factory()->post->create(
			array(
				'post_type'   => 'page',
				'post_status' => 'publish',
				'post_title'  => 'Check-in by hand',
			)
		);
		update_post_meta( $guest, Pages::META_KEY, Pages::ROLE_GUEST_ACCESS );
		$hand = wp_update_nav_menu_item(
			$menu_id,
			0,
			array(
				'menu-item-type'      => 'post_type',
				'menu-item-object'    => 'page',
				'menu-item-object-id' => $guest,
				'menu-item-title'     => 'My own name for it',
				'menu-item-status'    => 'publish',
				'menu-item-position'  => 3,
			)
		);
		$other_menu = wp_create_nav_menu( 'Footer' );

		// The position that is STORED for an entry: wp_get_nav_menu_items() numbers what it returns 1, 2, 3, whatever is stored.
		$state_of = static function ( $item ) {
			return array( $item->title, (int) get_post_field( 'menu_order', $item->ID ), $item->url, $item->object, (string) $item->object_id );
		};
		$before   = array();
		foreach ( wp_get_nav_menu_items( $menu_id ) as $item ) {
			$before[ $item->ID ] = $state_of( $item );
		}
		$this->assertCount( 3, $before );
		$this->assertSame( 7, max( wp_list_pluck( $before, 1 ) ), 'The last entry is stored at position 7, though it is the third.' );
		$order_before = wp_list_pluck( wp_get_nav_menu_items( $menu_id ), 'ID' );

		$result = Wizard::run( $this->form( array( 'menu' => (string) $menu_id ) ) );

		$this->assertSame( 'added', $result['menu']['items'][ Pages::ROLE_BOOKING ] );
		$this->assertSame( 'exists', $result['menu']['items'][ Pages::ROLE_GUEST_ACCESS ], 'An entry already points to the page: no second one.' );
		$this->assertSame( 'added', $result['menu']['items'][ Pages::ROLE_OWNER_AREA ] );
		$this->assertSame( 'Main menu', $result['menu']['name'] );

		$after = array();
		foreach ( wp_get_nav_menu_items( $menu_id ) as $item ) {
			$after[ $item->ID ] = $state_of( $item );
		}
		$this->assertCount( 5, $after, 'Three entries were there, two were added.' );
		foreach ( $before as $item_id => $state ) {
			$this->assertSame( $state, $after[ $item_id ], 'The entry ' . $item_id . ' was not moved, renamed or changed.' );
		}
		$this->assertSame( 'My own name for it', $after[ $hand ][0] );

		// The new entries come at the END, after the highest position that was stored, and point to the pages.
		$added = array_diff_key( $after, $before );
		$this->assertCount( 2, $added );
		foreach ( $added as $state ) {
			$this->assertGreaterThan( 7, $state[1], 'After the last entry that was there.' );
			$this->assertSame( 'page', $state[3] );
		}
		$this->assertSame( $order_before, array_slice( wp_list_pluck( wp_get_nav_menu_items( $menu_id ), 'ID' ), 0, 3 ), 'The entries that were there keep their order, and come first.' );
		$this->assertSame(
			array( (string) $result['pages'][ Pages::ROLE_BOOKING ]['id'], (string) $result['pages'][ Pages::ROLE_OWNER_AREA ]['id'] ),
			array_values( array_map( 'strval', wp_list_pluck( array_slice( wp_get_nav_menu_items( $menu_id ), -2 ), 'object_id' ) ) )
		);

		// The other menu was not asked for: it stays empty. And the foreign items of the first menu are exactly the same.
		$this->assertEmpty( wp_get_nav_menu_items( $other_menu ) );
		$this->assertNotEmpty( $home );
		$this->assertNotEmpty( $blog );
	}

	/**
	 * Security: a menu id that is not a registered menu is refused, and nothing is created.
	 */
	public function test_unknown_menu_is_refused() {
		$result = Wizard::run( $this->form( array( 'menu' => '987654' ) ) );

		$this->assertFalse( $result['ok'] );
		$this->assertSame( 'unknown_menu', $result['error'] );
		$this->assertSame( array(), $result['pages'] );
		$this->assertSame( 0, $this->count_pages() );

		// The id of a term of another taxonomy is not a menu either.
		$category = wp_insert_term( 'A category', 'category' );
		$this->assertIsArray( $category );
		$result = Wizard::run( $this->form( array( 'menu' => (string) $category['term_id'] ) ) );
		$this->assertSame( 'unknown_menu', $result['error'] );
		$this->assertSame( 0, $this->count_pages() );

		// Through the form too, and the result is shown on the tab.
		$this->submit( $this->form( array( 'menu' => '987654' ) ) );
		$this->assertSame( 0, $this->count_pages() );
		$_GET['tab'] = 'setup';
		ob_start();
		Admin::render_page();
		$html = (string) ob_get_clean();
		$this->assertStringContainsString( 'notice-error', $html );
		$this->assertStringContainsString( 'Nothing was created', $html );

		// Junk is no id.
		foreach ( array( '-3', 'abc', '1e3', '' ) as $junk ) {
			$this->submit( $this->form( array( 'menu' => $junk ) ) );
			$this->assertTrue( 3 === $this->count_pages() || 0 === $this->count_pages() );
			foreach ( $this->role_pages() as $page_id ) {
				if ( $page_id ) {
					wp_delete_post( $page_id, true );
				}
			}
		}
	}

	/**
	 * The page is published only when the box says so; otherwise it is a draft. A box that is not posted means no.
	 */
	public function test_pages_are_published_only_when_asked() {
		$result = Wizard::run( $this->form( array( 'publish' => '' ) ) );
		foreach ( Pages::roles() as $role ) {
			$this->assertSame( 'draft', get_post( $result['pages'][ $role ]['id'] )->post_status, $role );
			$this->assertSame( 'draft', $result['pages'][ $role ]['post_status'] );
			wp_delete_post( $result['pages'][ $role ]['id'], true );
		}

		// Through the form: a box that is not posted is not ticked.
		$form = $this->form();
		unset( $form['publish'] );
		$this->submit( $form );
		foreach ( $this->role_pages() as $role => $page_id ) {
			$this->assertSame( 'draft', get_post( $page_id )->post_status, $role );
			wp_delete_post( $page_id, true );
		}

		// Run with nothing at all: drafts, with the titles of the site language.
		$result = Wizard::run();
		foreach ( Pages::roles() as $role ) {
			$this->assertSame( 'draft', $result['pages'][ $role ]['post_status'], $role );
			wp_delete_post( $result['pages'][ $role ]['id'], true );
		}

		$result = Wizard::run( $this->form( array( 'publish' => '1' ) ) );
		foreach ( Pages::roles() as $role ) {
			$this->assertSame( 'publish', $result['pages'][ $role ]['post_status'], $role );
		}
	}

	/**
	 * A role whose box is not ticked is skipped: no page, no menu entry.
	 */
	public function test_a_role_that_is_not_ticked_is_skipped() {
		$menu_id = wp_create_nav_menu( 'Main' );
		$form    = $this->form( array( 'menu' => (string) $menu_id ) );
		unset( $form['pages'][ Pages::ROLE_OWNER_AREA ]['enabled'] );

		$this->submit( $form );

		$result = Wizard::take_result();
		$this->assertSame( 'created', $result['pages'][ Pages::ROLE_BOOKING ]['status'] );
		$this->assertSame( 'skipped', $result['pages'][ Pages::ROLE_OWNER_AREA ]['status'] );
		$this->assertSame( 0, Pages::find( Pages::ROLE_OWNER_AREA, 'any' ) );
		$this->assertArrayNotHasKey( Pages::ROLE_OWNER_AREA, $result['menu']['items'] );
		$this->assertCount( 2, wp_get_nav_menu_items( $menu_id ) );
		$this->assertCount( 2, $this->role_pages() ? array_filter( $this->role_pages() ) : array() );
	}

	/**
	 * Security: every input is cleaned: a title is plain text, an empty title takes the default, a slug comes from the title.
	 */
	public function test_input_is_sanitised() {
		$form = $this->form();
		$form['pages'][ Pages::ROLE_BOOKING ]['title']      = '<script>alert(1)</script><b>My</b> "booking" page <img src=x onerror=alert(2)>';
		$form['pages'][ Pages::ROLE_GUEST_ACCESS ]['title'] = '   ';
		$form['pages'][ Pages::ROLE_OWNER_AREA ]['title']   = array( 'not', 'text' );

		$this->submit( $form );

		$result = Wizard::take_result();
		$booking = get_post( $result['pages'][ Pages::ROLE_BOOKING ]['id'] );
		$this->assertSame( 'My "booking" page', $booking->post_title );
		$this->assertStringNotContainsString( '<', $booking->post_title );
		$this->assertSame( 'my-booking-page', $booking->post_name );
		$titles = Wizard::default_titles();
		$this->assertSame( $titles[ Pages::ROLE_GUEST_ACCESS ], get_post( $result['pages'][ Pages::ROLE_GUEST_ACCESS ]['id'] )->post_title );
		$this->assertSame( $titles[ Pages::ROLE_OWNER_AREA ], get_post( $result['pages'][ Pages::ROLE_OWNER_AREA ]['id'] )->post_title );

		// A title that has no letter for a slug still gets one.
		foreach ( $this->role_pages() as $page_id ) {
			wp_delete_post( $page_id, true );
		}
		$form = $this->form();
		$form['pages'][ Pages::ROLE_BOOKING ]['title'] = '!!! ???';
		$this->submit( $form );
		$result = Wizard::take_result();
		$this->assertNotSame( '', get_post( $result['pages'][ Pages::ROLE_BOOKING ]['id'] )->post_name );

		// Posted values that are not what they should be (arrays where text is expected) change nothing and break nothing.
		foreach ( $this->role_pages() as $page_id ) {
			wp_delete_post( $page_id, true );
		}
		$_POST    = array(
			'casazen_wizard'        => array(
				'pages'   => 'not an array',
				'publish' => array( 'x' ),
				'menu'    => array( '5' ),
			),
			Admin::NONCE_FIELD => wp_create_nonce( Wizard::ACTION ),
		);
		$_REQUEST = $_POST;
		$catch    = static function ( $location ) {
			throw new Casazen_Test_Wizard_Redirect( $location );
		};
		add_filter( 'wp_redirect', $catch );
		try {
			Wizard::handle_run();
		} catch ( Casazen_Test_Wizard_Redirect $redirect ) {
			$this->assertStringContainsString( 'tab=setup', $redirect->getMessage() );
		}
		remove_filter( 'wp_redirect', $catch );
		$this->assertSame( 0, $this->count_pages(), 'No role was ticked: nothing was created.' );
	}

	/**
	 * A title keeps its backslash and its quotes: the page is saved the way the editor would save it, not with its text changed.
	 */
	public function test_a_title_keeps_its_backslash_and_quotes() {
		$form = $this->form();
		$form['pages'][ Pages::ROLE_BOOKING ]['title'] = 'Book \\ "now" \'today\'';

		$this->submit( $form );

		$result = Wizard::take_result();
		$this->assertSame( 'Book \\ "now" \'today\'', get_post( $result['pages'][ Pages::ROLE_BOOKING ]['id'] )->post_title );
	}

	/**
	 * The default titles are Italian on an Italian site and English elsewhere.
	 */
	public function test_default_titles_follow_the_language_of_the_site() {
		$this->assertSame(
			array(
				Pages::ROLE_BOOKING      => 'Book',
				Pages::ROLE_GUEST_ACCESS => 'Online check-in',
				Pages::ROLE_OWNER_AREA   => 'Owner area',
			),
			Wizard::default_titles()
		);

		$this->speak_italian();
		$this->assertSame(
			array(
				Pages::ROLE_BOOKING      => 'Prenota',
				Pages::ROLE_GUEST_ACCESS => 'Check-in online',
				Pages::ROLE_OWNER_AREA   => 'Area proprietari',
			),
			Wizard::default_titles()
		);

		// The pages the setup makes on an Italian site carry those titles.
		$result = Wizard::run();
		$this->assertSame( 'Prenota', $result['pages'][ Pages::ROLE_BOOKING ]['title'] );
		$this->assertSame( 'prenota', $result['pages'][ Pages::ROLE_BOOKING ]['slug'] );
		$this->assertSame( 'check-in-online', $result['pages'][ Pages::ROLE_GUEST_ACCESS ]['slug'] );
		$this->assertSame( 'area-proprietari', $result['pages'][ Pages::ROLE_OWNER_AREA ]['slug'] );
	}

	/**
	 * A block theme has no classic menu to change: the result lists the pages with their links and says what to do.
	 */
	public function test_a_block_theme_gets_a_message_instead_of_menu_changes() {
		add_filter( 'casazen_wizard_is_block_theme', '__return_true' );
		$menu_id = wp_create_nav_menu( 'Main' );

		$result = Wizard::run( $this->form() );

		$this->assertTrue( $result['block_theme'] );
		$this->assertNull( $result['menu'] );
		$this->assertEmpty( wp_get_nav_menu_items( $menu_id ), 'No menu was changed.' );

		set_transient( Wizard::RESULT_PREFIX . $this->admin_id, $result, Wizard::RESULT_TTL );
		$_GET['tab'] = 'setup';
		ob_start();
		Admin::render_page();
		$html = (string) ob_get_clean();
		$this->assertStringContainsString( 'Add them to the Navigation block in the Site Editor', $html );
		foreach ( Pages::roles() as $role ) {
			$this->assertStringContainsString( esc_url( $result['pages'][ $role ]['url'] ), $html, 'The page is listed with its link.' );
		}

		// A classic menu that was chosen is changed all the same: the message is for a run with no menu.
		foreach ( $this->role_pages() as $page_id ) {
			wp_delete_post( $page_id, true );
		}
		$result = Wizard::run( $this->form( array( 'menu' => (string) $menu_id ) ) );
		$this->assertFalse( $result['block_theme'] );
		$this->assertCount( 3, wp_get_nav_menu_items( $menu_id ) );

		// A classic theme gets no such message.
		remove_filter( 'casazen_wizard_is_block_theme', '__return_true' );
		add_filter( 'casazen_wizard_is_block_theme', '__return_false' );
		foreach ( $this->role_pages() as $page_id ) {
			wp_delete_post( $page_id, true );
		}
		$this->assertFalse( Wizard::run( $this->form() )['block_theme'] );
	}

	/**
	 * Without Polylang the result does not talk about it.
	 */
	public function test_the_result_says_nothing_of_polylang_without_it() {
		$result = Wizard::run( $this->form() );

		$this->assertFalse( $result['polylang'] );
		set_transient( Wizard::RESULT_PREFIX . $this->admin_id, $result, Wizard::RESULT_TTL );
		$_GET['tab'] = 'setup';
		ob_start();
		Admin::render_page();
		$this->assertStringNotContainsString( 'Polylang', (string) ob_get_clean() );
	}

	/**
	 * What the last run left is kept for display, and the idempotency does not depend on it.
	 */
	public function test_the_state_option_is_for_display_only() {
		$this->assertSame( array(), Wizard::state() );

		$result = Wizard::run( $this->form() );

		$state = Wizard::state();
		$this->assertTrue( $state['completed'] );
		$this->assertEqualsWithDelta( time(), $state['time'], 30 );
		$this->assertSame( wp_list_pluck( $result['pages'], 'id' ), $state['pages'] );
		$autoload = $GLOBALS['wpdb']->get_var( $GLOBALS['wpdb']->prepare( "SELECT autoload FROM {$GLOBALS['wpdb']->options} WHERE option_name = %s", Wizard::STATE_OPTION ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$this->assertContains( $autoload, array( 'no', 'off', 'auto-off' ), 'The option is not loaded on every request.' );

		// Without the option the run still finds the pages: it never reads it.
		delete_option( Wizard::STATE_OPTION );
		$again = Wizard::run( $this->form() );
		foreach ( Pages::roles() as $role ) {
			$this->assertSame( 'exists', $again['pages'][ $role ]['status'] );
		}

		// With a state that lies, nothing is believed either.
		update_option( Wizard::STATE_OPTION, array( 'completed' => false, 'time' => 1, 'pages' => array() ), false ); // phpcs:ignore WordPress.Arrays.MultipleStatementAlignment
		$this->assertSame( 'exists', Wizard::run( $this->form() )['pages'][ Pages::ROLE_BOOKING ]['status'] );
	}

	/**
	 * The tab: the form with the three pages, the box, the menus and the nonce; the result once; escaped.
	 */
	public function test_the_tab_shows_the_form_then_the_result_once() {
		wp_create_nav_menu( 'Main menu' );
		$_GET['tab'] = 'setup';

		ob_start();
		Admin::render_page();
		$html = (string) ob_get_clean();

		$this->assertStringContainsString( 'nav-tab-active', $html );
		$this->assertStringContainsString( 'action=casazen_run_wizard', $html );
		$this->assertStringContainsString( 'name="' . Admin::NONCE_FIELD . '"', $html );
		$this->assertStringContainsString( 'value="Book"', $html );
		$this->assertStringContainsString( 'value="Online check-in"', $html );
		$this->assertStringContainsString( 'value="Owner area"', $html );
		foreach ( Pages::roles() as $role ) {
			$this->assertStringContainsString( 'name="casazen_wizard[pages][' . $role . '][enabled]"', $html );
			$this->assertStringContainsString( 'name="casazen_wizard[pages][' . $role . '][title]"', $html );
		}
		$this->assertSame( 1, preg_match( '/name="casazen_wizard\[publish\]"[^>]*checked/', $html ), 'The box «Publish the pages now» is ticked by default.' );
		$this->assertSame( 3, preg_match_all( '/name="casazen_wizard\[pages\]\[[a-z_]+\]\[enabled\]"[^>]*checked/', $html ), 'Every page is ticked by default.' );
		$this->assertStringContainsString( 'name="casazen_wizard[menu]"', $html );
		$this->assertStringContainsString( 'Do not add menu entries', $html );
		$this->assertSame( 1, preg_match( '/<option value="\d+">Main menu<\/option>/', $html ), 'The menus of the site are offered by name.' );
		$this->assertStringNotContainsString( 'Last run:', $html, 'Nothing has run yet.' );
		$this->assertStringContainsString( '[casazen_search]', $html, 'The hint about the search bar.' );
		$this->assertStringContainsString( 'Shortcode widget', $html );

		// The result of a run is shown once, escaped.
		$result = Wizard::run( $this->form() );
		set_transient( Wizard::RESULT_PREFIX . $this->admin_id, $result, Wizard::RESULT_TTL );
		ob_start();
		Admin::render_page();
		$html = (string) ob_get_clean();
		$this->assertStringContainsString( 'notice-success', $html );
		foreach ( Pages::roles() as $role ) {
			$this->assertStringContainsString( esc_url( $result['pages'][ $role ]['url'] ), $html );
		}
		$this->assertStringContainsString( 'Page created.', $html );
		$this->assertStringContainsString( 'Last run:', $html, 'The time of the last run is shown.' );

		ob_start();
		Admin::render_page();
		$this->assertStringNotContainsString( 'notice-success', (string) ob_get_clean(), 'The result is deleted when it is shown.' );
		$this->assertNull( Wizard::take_result() );
	}

	/**
	 * A user who is not the one who ran the setup does not see its result, and the result waits only five minutes.
	 */
	public function test_the_result_belongs_to_the_user_and_expires() {
		if ( wp_using_ext_object_cache() ) {
			$this->markTestSkipped( 'The timeout of a transient is only in the options table without an external object cache.' );
		}
		$this->submit( $this->form() );
		$key = Wizard::RESULT_PREFIX . $this->admin_id;
		$this->assertEqualsWithDelta( time() + 5 * MINUTE_IN_SECONDS, (int) get_option( '_transient_timeout_' . $key ), 10 );

		$other = self::factory()->user->create( array( 'role' => 'administrator' ) );
		wp_set_current_user( $other );
		$this->assertNull( Wizard::take_result(), 'Another user has no result.' );

		wp_set_current_user( $this->admin_id );
		$this->assertIsArray( Wizard::take_result() );
		$this->assertNull( Wizard::take_result(), 'Taken once.' );
	}

	/**
	 * The pages of the setup are the content of the agency: the setup never deletes anything, not even a page it made earlier.
	 */
	public function test_nothing_is_ever_deleted() {
		$first = Wizard::run( $this->form() );
		wp_trash_post( $first['pages'][ Pages::ROLE_OWNER_AREA ]['id'] );
		$count = count( get_posts( array( 'post_type' => 'page', 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids' ) ) ); // phpcs:ignore WordPress.Arrays.MultipleStatementAlignment

		Wizard::run( $this->form() );

		$this->assertSame( 'trash', get_post( $first['pages'][ Pages::ROLE_OWNER_AREA ]['id'] )->post_status, 'A trashed page stays in the trash.' );
		$this->assertSame( $count + 1, count( get_posts( array( 'post_type' => 'page', 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids' ) ) ) ); // phpcs:ignore WordPress.Arrays.MultipleStatementAlignment
		$this->assertSame( $first['pages'][ Pages::ROLE_BOOKING ]['id'], Pages::find( Pages::ROLE_BOOKING, 'any' ) );
	}
}
