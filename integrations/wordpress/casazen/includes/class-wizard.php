<?php
/**
 * The guided setup: creates the pages of the booking site and their menu entries, without ever overwriting anything.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Creates the pages «Book», «Online check-in» and «Owner area» (in Italian «Prenota», «Check-in online» and «Area proprietari»)
 * and adds them to a classic menu.
 *
 * The rules, in order of importance:
 *
 * - IDEMPOTENT. A role is done when a page with the role meta exists in any status but trash, in any language. Such a page is
 *   reported as `exists` and NOTHING of it changes. A second run creates nothing.
 * - A page that has the same slug but no role meta is somebody else's: it is never adopted and never overwritten; the new page
 *   takes the next free slug.
 * - Menu entries are only ADDED, at the end of the chosen classic menu, and only when no entry of that menu points to the page.
 *   Existing entries are never moved, renamed or removed. A block theme has no classic menu to change: the pages are listed.
 * - No translation is created. No dependency on Polylang, WPML or Elementor.
 *
 * Whoever runs it (the admin form, see handle_run()) has checked the capabilities and the nonce; run() itself only does the work.
 */
class Wizard {

	/**
	 * The action of the form (`admin-post.php?action=casazen_run_wizard`) and the action of its nonce.
	 *
	 * @var string
	 */
	const ACTION = 'casazen_run_wizard';

	/**
	 * The option that remembers the last run, for display only: nothing depends on it.
	 *
	 * @var string
	 */
	const STATE_OPTION = 'casazen_wizard_state';

	/**
	 * The result of the last run of a user is kept in a transient named with this prefix and the id of the user.
	 *
	 * @var string
	 */
	const RESULT_PREFIX = 'casazen_wizard_result_';

	/**
	 * How long the result of a run waits to be shown (5 minutes).
	 *
	 * @var int
	 */
	const RESULT_TTL = 5 * MINUTE_IN_SECONDS;

	/**
	 * The shortcode each page holds, by role.
	 *
	 * @var string[]
	 */
	const SHORTCODES = array(
		Pages::ROLE_BOOKING      => '[casazen_booking]',
		Pages::ROLE_GUEST_ACCESS => '[casazen_guest_access]',
		Pages::ROLE_OWNER_AREA   => '[casazen_owner_login]',
	);

	/**
	 * Hooks the form into admin-post (only called in the admin).
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'admin_post_' . self::ACTION, array( __CLASS__, 'handle_run' ) );
	}

	/**
	 * The default titles of the three pages, in the language of the SITE: Italian on an Italian site (a locale `it_*`), English
	 * elsewhere. They come from the translations of the plugin; an administrator who reads the screen in another language than
	 * the site gets the titles of the site all the same, because the pages are for the visitors of the site.
	 *
	 * @return string[] Role => title.
	 */
	public static function default_titles() {
		$site_locale = get_locale();
		$switched    = false;
		if ( function_exists( 'switch_to_locale' ) && determine_locale() !== $site_locale ) {
			$switched = switch_to_locale( $site_locale );
		}

		$titles = array(
			Pages::ROLE_BOOKING      => __( 'Book', 'casazen' ),
			Pages::ROLE_GUEST_ACCESS => __( 'Online check-in', 'casazen' ),
			Pages::ROLE_OWNER_AREA   => __( 'Owner area', 'casazen' ),
		);

		if ( $switched ) {
			restore_previous_locale();
		}
		return $titles;
	}

	/**
	 * The classic menus of the site.
	 *
	 * @return \WP_Term[]
	 */
	public static function menus() {
		$menus = wp_get_nav_menus();
		return is_array( $menus ) ? $menus : array();
	}

	/**
	 * Whether the active theme is a block theme: it has no classic menu, its navigation is edited in the Site Editor.
	 *
	 * @return bool
	 */
	public static function is_block_theme() {
		/**
		 * Filters whether the guided setup treats the theme as a block theme (no classic menu to change).
		 *
		 * @param bool $is_block_theme What wp_is_block_theme() says.
		 */
		return (bool) apply_filters( 'casazen_wizard_is_block_theme', function_exists( 'wp_is_block_theme' ) && wp_is_block_theme() );
	}

	/**
	 * What the last run left: the time and the page of each role. For display only.
	 *
	 * @return array { completed: bool, time: int, pages: array role => id }, empty before the first run.
	 */
	public static function state() {
		$state = get_option( self::STATE_OPTION, array() );
		return is_array( $state ) ? $state : array();
	}

	/**
	 * The result of the last run of the current user, once: it is deleted when it is read.
	 *
	 * @return array|null The result of run(), or null when there is none (or it is older than five minutes).
	 */
	public static function take_result() {
		$key    = self::RESULT_PREFIX . get_current_user_id();
		$result = get_transient( $key );
		delete_transient( $key );
		return is_array( $result ) ? $result : null;
	}

	/**
	 * The form: checks the capabilities and the nonce, reads the choices, runs the setup and comes back to the tab with the result.
	 *
	 * Needs `manage_options` (the screen), `publish_pages` (the pages) and `edit_theme_options` when a menu is chosen. The
	 * connection must have been tested with a good result.
	 *
	 * @return void
	 */
	public static function handle_run() {
		if ( ! current_user_can( Admin::CAPABILITY ) || ! current_user_can( 'publish_pages' ) ) {
			wp_die(
				esc_html__( 'You do not have permission to do this.', 'casazen' ),
				'',
				array( 'response' => 403 )
			);
		}
		check_admin_referer( self::ACTION, Admin::NONCE_FIELD );

		$choices = self::read_request();
		if ( $choices['menu'] > 0 && ! current_user_can( 'edit_theme_options' ) ) {
			wp_die(
				esc_html__( 'You do not have permission to do this.', 'casazen' ),
				'',
				array( 'response' => 403 )
			);
		}

		$connection = Connection::cached();
		if ( ! is_array( $connection ) || empty( $connection['ok'] ) ) {
			$result = self::empty_result();
			$result['ok']    = false;
			$result['error'] = 'not_connected';
		} else {
			$result = self::run( $choices );
		}
		set_transient( self::RESULT_PREFIX . get_current_user_id(), $result, self::RESULT_TTL );

		wp_safe_redirect(
			add_query_arg(
				array(
					'page' => Admin::PAGE_SLUG,
					'tab'  => Admin::TAB_SETUP,
				),
				admin_url( 'options-general.php' )
			)
		);
		exit;
	}

	/**
	 * Creates the pages and the menu entries that are still missing.
	 *
	 * @param array $choices {
	 *     What to do. Every key is optional.
	 *
	 *     @type array $pages   Role => { enabled: bool (default true), title: string (default the title of the site language) }.
	 *     @type bool  $publish Whether to publish the new pages; otherwise they are saved as drafts. Default false.
	 *     @type int   $menu    The id of a classic menu to add the pages to; 0 (default) for none. It must be one of the menus.
	 * }
	 * @return array {
	 *     @type bool   $ok          False when nothing was done (see `error`).
	 *     @type string $error       '', `unknown_menu` or `not_connected`.
	 *     @type array  $pages       Role => { status: created|exists|skipped|failed, id, title, slug, wanted_slug, url, post_status }.
	 *     @type array  $menu        null, or { id, name, items: role => added|exists|failed }.
	 *     @type bool   $block_theme True when no menu was chosen and the theme is a block theme: the pages must be added by hand.
	 *     @type bool   $polylang    True when Polylang is active: the pages are in its default language and are not translated.
	 * }
	 */
	public static function run( array $choices = array() ) {
		$choices = self::normalise_choices( $choices );
		$result  = self::empty_result();

		// The menu is checked before anything is created: an id that is not one of the menus changes nothing.
		$menu = null;
		if ( $choices['menu'] > 0 ) {
			$menu = self::find_menu( $choices['menu'] );
			if ( null === $menu ) {
				$result['ok']    = false;
				$result['error'] = 'unknown_menu';
				return $result;
			}
		}

		$status = $choices['publish'] ? 'publish' : 'draft';
		foreach ( Pages::roles() as $role ) {
			$wanted = $choices['pages'][ $role ];
			if ( ! $wanted['enabled'] ) {
				$result['pages'][ $role ] = array( 'status' => 'skipped' );
				continue;
			}
			$result['pages'][ $role ] = self::ensure_page( $role, $wanted['title'], $status );
		}

		if ( null !== $menu ) {
			$result['menu'] = self::add_to_menu( $menu, $result['pages'] );
		} elseif ( self::is_block_theme() ) {
			$result['block_theme'] = true;
		}
		$result['polylang'] = function_exists( 'pll_set_post_language' );

		self::remember( $result );
		return $result;
	}

	/**
	 * The result of a run that did nothing.
	 *
	 * @return array
	 */
	private static function empty_result() {
		return array(
			'ok'          => true,
			'error'       => '',
			'pages'       => array(),
			'menu'        => null,
			'block_theme' => false,
			'polylang'    => false,
		);
	}

	/**
	 * Reads and cleans what the form posted. The nonce has been checked by the caller.
	 *
	 * @return array The choices, as run() takes them.
	 */
	private static function read_request() {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- the nonce was checked by check_admin_referer(); every value is cleaned below.
		$posted = isset( $_POST['casazen_wizard'] ) && is_array( $_POST['casazen_wizard'] ) ? wp_unslash( $_POST['casazen_wizard'] ) : array();

		$choices = array(
			'pages'   => array(),
			'publish' => ! empty( $posted['publish'] ),
			'menu'    => isset( $posted['menu'] ) && is_scalar( $posted['menu'] ) ? absint( $posted['menu'] ) : 0,
		);
		foreach ( Pages::roles() as $role ) {
			$page = ( isset( $posted['pages'][ $role ] ) && is_array( $posted['pages'][ $role ] ) ) ? $posted['pages'][ $role ] : array();

			$choices['pages'][ $role ] = array(
				// A box that is not checked is not posted at all.
				'enabled' => ! empty( $page['enabled'] ),
				'title'   => ( isset( $page['title'] ) && is_string( $page['title'] ) ) ? sanitize_text_field( $page['title'] ) : '',
			);
		}
		return $choices;
	}

	/**
	 * Fills in what run() was not given and cleans what it was.
	 *
	 * @param array $choices The choices as given.
	 * @return array { pages: role => { enabled, title }, publish: bool, menu: int }
	 */
	private static function normalise_choices( array $choices ) {
		$titles = self::default_titles();
		$clean  = array(
			'pages'   => array(),
			'publish' => ! empty( $choices['publish'] ),
			'menu'    => isset( $choices['menu'] ) && is_scalar( $choices['menu'] ) ? absint( $choices['menu'] ) : 0,
		);
		foreach ( Pages::roles() as $role ) {
			$page  = ( isset( $choices['pages'][ $role ] ) && is_array( $choices['pages'][ $role ] ) ) ? $choices['pages'][ $role ] : array();
			$title = ( isset( $page['title'] ) && is_string( $page['title'] ) ) ? trim( sanitize_text_field( $page['title'] ) ) : '';

			$clean['pages'][ $role ] = array(
				'enabled' => ! array_key_exists( 'enabled', $page ) || ! empty( $page['enabled'] ),
				'title'   => '' !== $title ? $title : $titles[ $role ],
			);
		}
		return $clean;
	}

	/**
	 * A classic menu, only if it is one of the menus of the site.
	 *
	 * @param int $menu_id The id asked for.
	 * @return \WP_Term|null
	 */
	private static function find_menu( $menu_id ) {
		foreach ( self::menus() as $menu ) {
			if ( (int) $menu->term_id === (int) $menu_id ) {
				return $menu;
			}
		}
		return null;
	}

	/**
	 * The page of a role: the one that exists (left exactly as it is) or a new one.
	 *
	 * @param string $role   The role.
	 * @param string $title  The title for a new page.
	 * @param string $status `publish` or `draft`, for a new page.
	 * @return array The description of the page (see run()).
	 */
	private static function ensure_page( $role, $title, $status ) {
		$existing = Pages::find( $role, 'any' );
		if ( $existing > 0 ) {
			return self::describe( 'exists', $existing, '' );
		}

		// The slug comes from the title; when another page already has it, the next free one is taken, as for a published page
		// (a draft keeps whatever slug it is given, so the check is made as if the page were published).
		$wanted = sanitize_title( $title );
		if ( '' === $wanted ) {
			$wanted = sanitize_title( str_replace( '_', '-', $role ) );
		}
		$slug = wp_unique_post_slug( $wanted, 0, 'publish', 'page', 0 );

		$content = self::SHORTCODES[ $role ];
		$content = '<!-- wp:shortcode -->' . $content . '<!-- /wp:shortcode -->';

		/**
		 * Filters the content of a page that the guided setup creates.
		 *
		 * @param string $content The content: a shortcode block.
		 * @param string $role    The role of the page: `booking`, `guest_access` or `owner_area`.
		 */
		$filtered = apply_filters( 'casazen_wizard_page_content', $content, $role );
		if ( is_string( $filtered ) && '' !== $filtered ) {
			$content = $filtered;
		}

		// wp_insert_post() takes slashed data, like everything that comes from a form: a title with a backslash keeps it.
		$page_id = wp_insert_post(
			wp_slash(
				array(
					'post_type'      => 'page',
					'post_status'    => $status,
					'post_title'     => $title,
					'post_name'      => $slug,
					'post_content'   => $content,
					'post_author'    => get_current_user_id(),
					'comment_status' => 'closed',
					'ping_status'    => 'closed',
					'meta_input'     => array( Pages::META_KEY => $role ),
				)
			),
			true
		);
		if ( is_wp_error( $page_id ) || ! is_int( $page_id ) || $page_id <= 0 ) {
			return array( 'status' => 'failed' );
		}

		Compat\Polylang_Wpml::set_default_language( $page_id );
		return self::describe( 'created', $page_id, $wanted );
	}

	/**
	 * What the result says about a page.
	 *
	 * @param string $status      `created` or `exists`.
	 * @param int    $page_id     The id of the page.
	 * @param string $wanted_slug The slug the title gave (for a new page).
	 * @return array
	 */
	private static function describe( $status, $page_id, $wanted_slug ) {
		$post = get_post( $page_id );
		if ( ! $post instanceof \WP_Post ) {
			return array( 'status' => 'failed' );
		}
		$url = get_permalink( $post );
		return array(
			'status'      => $status,
			'id'          => (int) $page_id,
			'title'       => get_the_title( $post ),
			'slug'        => $post->post_name,
			'wanted_slug' => $wanted_slug,
			'url'         => is_string( $url ) ? $url : '',
			'post_status' => $post->post_status,
		);
	}

	/**
	 * Adds the pages at the END of a classic menu, each only if no entry of the menu points to it. Nothing that is in the menu is
	 * touched.
	 *
	 * @param \WP_Term $menu  The menu.
	 * @param array    $pages The pages of the run, by role.
	 * @return array { id, name, items: role => added|exists|failed }
	 */
	private static function add_to_menu( $menu, array $pages ) {
		$items = wp_get_nav_menu_items( $menu->term_id, array( 'post_status' => 'any' ) );
		$items = is_array( $items ) ? $items : array();

		$linked   = array();
		$position = 0;
		foreach ( $items as $item ) {
			if ( isset( $item->object, $item->object_id ) && 'page' === $item->object ) {
				$linked[ (int) $item->object_id ] = true;
			}
			// wp_get_nav_menu_items() hands the entries back numbered 1, 2, 3...: the position that is stored for the last one can
			// be much higher, and a new entry numbered from the returned values would land in the middle of the menu.
			if ( isset( $item->ID ) ) {
				$position = max( $position, (int) get_post_field( 'menu_order', (int) $item->ID ) );
			}
		}

		$report = array();
		foreach ( Pages::roles() as $role ) {
			if ( ! isset( $pages[ $role ]['id'] ) || ! in_array( $pages[ $role ]['status'], array( 'created', 'exists' ), true ) ) {
				continue;
			}
			$page_id = (int) $pages[ $role ]['id'];
			if ( isset( $linked[ $page_id ] ) ) {
				$report[ $role ] = 'exists';
				continue;
			}

			++$position;
			$item_id = wp_update_nav_menu_item(
				$menu->term_id,
				0,
				array(
					'menu-item-type'      => 'post_type',
					'menu-item-object'    => 'page',
					'menu-item-object-id' => $page_id,
					'menu-item-status'    => 'publish',
					'menu-item-position'  => $position,
				)
			);
			if ( is_wp_error( $item_id ) || ! $item_id ) {
				$report[ $role ] = 'failed';
				continue;
			}
			$linked[ $page_id ] = true;
			$report[ $role ]    = 'added';
		}

		return array(
			'id'    => (int) $menu->term_id,
			'name'  => (string) $menu->name,
			'items' => $report,
		);
	}

	/**
	 * Remembers the last run, for display.
	 *
	 * @param array $result The result of the run.
	 * @return void
	 */
	private static function remember( array $result ) {
		$pages = array();
		foreach ( Pages::roles() as $role ) {
			if ( isset( $result['pages'][ $role ]['id'] ) ) {
				$pages[ $role ] = (int) $result['pages'][ $role ]['id'];
			}
		}
		update_option(
			self::STATE_OPTION,
			array(
				'completed' => count( $pages ) === count( Pages::roles() ),
				'time'      => time(),
				'pages'     => $pages,
			),
			false
		);
	}
}
