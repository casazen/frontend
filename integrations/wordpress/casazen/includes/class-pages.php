<?php
/**
 * The pages of the site that carry a role (booking, guest access, owner area).
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Finds the pages that have a role. The role is a post meta, so a page keeps it when its title, its slug or its address change.
 */
class Pages {

	/**
	 * The page with the booking engine: the search bar sends the guest there.
	 *
	 * @var string
	 */
	const ROLE_BOOKING = 'booking';

	/**
	 * The page where a guest opens a booking.
	 *
	 * @var string
	 */
	const ROLE_GUEST_ACCESS = 'guest_access';

	/**
	 * The page with the link to the owner area.
	 *
	 * @var string
	 */
	const ROLE_OWNER_AREA = 'owner_area';

	/**
	 * The post meta that holds the role of a page.
	 *
	 * @var string
	 */
	const META_KEY = '_casazen_page_role';

	/**
	 * The three roles, in the order the guided setup handles them.
	 *
	 * @return string[]
	 */
	public static function roles() {
		return array( self::ROLE_BOOKING, self::ROLE_GUEST_ACCESS, self::ROLE_OWNER_AREA );
	}

	/**
	 * The address of the published page that carries a role, in the language of the page that is printed.
	 *
	 * The role is found in any language. When Polylang or WPML is active and has a published translation of that page into the
	 * current language, the address is the one of the translation; otherwise it is the address of the page itself.
	 *
	 * @param string $role One of the roles.
	 * @return string The permalink, or an empty string when no published page carries the role.
	 */
	public static function url_for_role( $role ) {
		$page_id = self::find( $role, 'publish' );
		if ( 0 === $page_id ) {
			return '';
		}

		$translated = Compat\Polylang_Wpml::translate_page( $page_id );
		if ( $translated !== $page_id && 'publish' !== get_post_status( $translated ) ) {
			// A translation that is a draft (or is gone) is no page to send a guest to.
			$translated = $page_id;
		}

		$url = get_permalink( $translated );
		return is_string( $url ) ? $url : '';
	}

	/**
	 * The id of the page that carries a role, in any language.
	 *
	 * Several pages with the same role should not exist; if they do, the oldest wins, so the answer does not change from one
	 * request to the next.
	 *
	 * @param string       $role   One of the roles.
	 * @param string|array $status A post status, `any` (every status but trash) or a list of them.
	 * @return int The id, or 0 when there is none.
	 */
	public static function find( $role, $status = 'any' ) {
		if ( ! in_array( $role, self::roles(), true ) ) {
			return 0;
		}

		$ids = get_posts(
			array(
				'post_type'        => 'page',
				'post_status'      => $status,
				'meta_key'         => self::META_KEY, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- one page, found by its role.
				'meta_value'       => $role, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- same as above.
				'fields'           => 'ids',
				'numberposts'      => 1,
				'orderby'          => 'ID',
				'order'            => 'ASC',
				'lang'             => '', // Polylang: every language, not only the current one.
				'suppress_filters' => true, // WPML: the same.
				'no_found_rows'    => true,
			)
		);
		return empty( $ids ) ? 0 : (int) $ids[0];
	}
}
