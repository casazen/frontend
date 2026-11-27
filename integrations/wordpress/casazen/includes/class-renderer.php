<?php
/**
 * The renderer: the ONE place that builds the markup of a widget.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Prints the widgets. A shortcode and a block with the same attributes give the same markup because both call
 * Renderer::widget() and nothing else; attribute_map() is the one list of what a widget accepts.
 *
 * Every attribute is whitelisted and validated here: an unknown one is ignored and an invalid value falls back to its default.
 * Every value is escaped where it is printed. A page load never calls CasaZen: the connection data and the destinations come
 * from transients (a miss schedules one background event).
 */
class Renderer {

	/**
	 * The widget that is a plain link, never a frame: the owner portal and its sign-in can not be framed. Every other widget is
	 * an element that the loader mounts (a frame, or the search bar the loader draws itself).
	 *
	 * @var string
	 */
	const OWNER_LOGIN = 'owner-login';

	/**
	 * The ids of the fonts of the booking site (`src/lib/public-site-themes.ts`).
	 *
	 * @var string[]
	 */
	const FONTS = array( 'editoriale', 'moderno', 'classico' );

	/**
	 * Most guests a booking or a property widget opens with.
	 *
	 * @var int
	 */
	const MAX_GUESTS = 30;

	/**
	 * Most guests the search bar takes.
	 *
	 * @var int
	 */
	const MAX_SEARCH_GUESTS = 99;

	/**
	 * The initial height of a frame, in pixels: from this value...
	 *
	 * @var int
	 */
	const MIN_HEIGHT = 100;

	/**
	 * ...to this one.
	 *
	 * @var int
	 */
	const MAX_HEIGHT = 2000;

	/**
	 * Longest address a search bar may lead to.
	 *
	 * @var int
	 */
	const MAX_TARGET_LENGTH = 2000;

	/**
	 * Longest label of the owner link, in characters.
	 *
	 * @var int
	 */
	const MAX_LABEL_LENGTH = 100;

	/**
	 * A date as `Y-m-d` (it must also be a real day).
	 *
	 * @var string
	 */
	const DATE_PATTERN = '/^(\d{4})-(\d{2})-(\d{2})$/D';

	/**
	 * A colour: `#rgb` or `#rrggbb`.
	 *
	 * @var string
	 */
	const COLOR_PATTERN = '/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/D';

	/**
	 * A radius: a whole number followed by `px` (0 to 32) or `rem` (0 to 2).
	 *
	 * @var string
	 */
	const RADIUS_PATTERN = '/^(\d{1,2})(px|rem)$/D';

	/**
	 * The path of the owner sign-in on the address of the agency.
	 *
	 * @var string
	 */
	const OWNER_LOGIN_PATH = '/portale-proprietari/accedi';

	/**
	 * Every widget with every attribute it accepts: name => { type (`string`, `integer` or `boolean`), default (null: no value) }.
	 *
	 * The shortcodes read the names, the blocks (`blocks/src/<name>/block.json`) must declare the same names, types and defaults;
	 * a test compares them.
	 *
	 * @return array[]
	 */
	public static function attribute_map() {
		$text   = array(
			'type'    => 'string',
			'default' => '',
		);
		$number = array(
			'type'    => 'integer',
			'default' => null,
		);
		$theme  = array(
			'primary' => $text,
			'radius'  => $text,
			'font'    => $text,
		);

		$booking = array_merge(
			array(
				'lang'       => $text,
				'checkin'    => $text,
				'checkout'   => $text,
				'guests'     => $number,
				'datalayer'  => array(
					'type'    => 'boolean',
					'default' => true,
				),
				'sync_url'   => array(
					'type'    => 'boolean',
					'default' => false,
				),
				'min_height' => $number,
			),
			$theme
		);

		return array(
			'booking'      => $booking,
			'property'     => array_merge( array( 'slug' => $text ), $booking ),
			'search'       => array_merge(
				array(
					'target'       => $text,
					'lang'         => $text,
					'destinations' => array(
						'type'    => 'string',
						'default' => 'yes',
					),
					'max_guests'   => $number,
				),
				$theme
			),
			'guest-access' => array_merge(
				array(
					'lang'       => $text,
					'datalayer'  => array(
						'type'    => 'boolean',
						'default' => true,
					),
					'min_height' => $number,
				),
				$theme
			),
			'owner-login'  => array( 'label' => $text ),
		);
	}

	/**
	 * The markup of a widget, as one line with no newline character (the content filters would turn a newline into a `<br />`).
	 *
	 * Empty address: nothing for visitors, a notice for administrators. An agency that CasaZen says has no embedding yet: an HTML
	 * comment (and the notice for administrators). Everything CasaZen has not said (nothing cached yet, a field the answer does
	 * not carry) counts as unknown and prints the element.
	 *
	 * @param string $widget One of `booking`, `property`, `search`, `guest-access`, `owner-login`.
	 * @param array  $atts   The attributes of the shortcode or of the block; only the known ones are read.
	 * @return string
	 */
	public static function widget( $widget, array $atts = array() ) {
		$map = self::attribute_map();
		if ( ! is_string( $widget ) || ! isset( $map[ $widget ] ) ) {
			return '';
		}

		$settings = Settings::get();
		if ( '' === $settings['address'] ) {
			return self::notice( __( 'CasaZen: set the address in Settings → CasaZen', 'casazen' ) );
		}

		if ( self::OWNER_LOGIN === $widget ) {
			return self::owner_login( $settings, $atts );
		}

		$connection = Connection::current();
		if ( is_array( $connection ) && false === $connection['embedEnabled'] ) {
			return self::hidden(
				'CasaZen: embedding is not enabled for this agency yet.',
				__( 'CasaZen: embedding is not enabled for this agency yet.', 'casazen' )
			);
		}

		$clean = self::clean( $widget, $atts );
		if ( 'property' === $widget && '' === $clean['slug'] ) {
			return self::hidden(
				'CasaZen: the property widget needs a valid slug.',
				__( 'CasaZen: the property widget needs the slug of a property, for example slug="villa-rossa".', 'casazen' )
			);
		}

		/**
		 * Filters whether a widget is printed as a static placeholder instead of the real element.
		 *
		 * The page builders turn it on in their editor and preview, where an iframe is not wanted (and the loader is not loaded).
		 *
		 * @param bool   $placeholder Whether to print the placeholder. Default false.
		 * @param string $widget      The widget.
		 * @param array  $clean       The validated attributes of the widget.
		 */
		if ( apply_filters( 'casazen_render_placeholder', false, $widget, $clean ) ) {
			return '<div class="casazen-placeholder">' . esc_html__( 'CasaZen — the booking engine appears on the published page', 'casazen' ) . '</div>';
		}

		$html = self::element( $widget, $clean, $settings );
		Assets::require_loader();
		return $html;
	}

	/**
	 * The address a search bar leads to, when its `target` is acceptable.
	 *
	 * Accepted: a path of this site that starts with a single slash, an address with the same host as this site (http or https),
	 * or any https address. Refused (an empty string): any other scheme (`javascript:`, `data:`...), an address with a user name
	 * or a password, a protocol-relative address (`//host`), white space or a character that has no place in an address.
	 *
	 * @param mixed $value The `target` as written.
	 * @return string The address, or an empty string.
	 */
	public static function sanitize_target( $value ) {
		if ( ! is_string( $value ) ) {
			return '';
		}
		$value = trim( $value );
		if ( '' === $value || strlen( $value ) > self::MAX_TARGET_LENGTH || 1 === preg_match( '/[\x00-\x20\x7F\\\\]/', $value ) ) {
			return '';
		}
		// Whatever WordPress would strip from an address (quotes, angle brackets...) or change in it (a missing scheme, a scheme that
		// is not http or https) means the value is not an address. The case of the scheme does not matter.
		if ( strtolower( esc_url_raw( $value, array( 'http', 'https' ) ) ) !== strtolower( $value ) ) {
			return '';
		}

		if ( '/' === $value[0] ) {
			return ( isset( $value[1] ) && '/' === $value[1] ) ? '' : $value;
		}

		$parts = wp_parse_url( $value );
		if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) || ! is_string( $parts['host'] ) ) {
			return '';
		}
		if ( array_key_exists( 'user', $parts ) || array_key_exists( 'pass', $parts ) ) {
			return '';
		}
		$scheme = strtolower( $parts['scheme'] );
		$host   = strtolower( $parts['host'] );
		if ( 1 !== preg_match( Settings::HOST_PATTERN, $host ) ) {
			return '';
		}
		if ( 'https' === $scheme ) {
			return $value;
		}
		if ( 'http' === $scheme && strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) ) === $host ) {
			return $value;
		}
		return '';
	}

	/**
	 * The attributes of a widget, whitelisted and validated: every known name has a value, the default when the given one is
	 * missing or not valid. Unknown names are ignored.
	 *
	 * @param string $widget The widget.
	 * @param array  $atts   The attributes as written.
	 * @return array name => value (null: no value).
	 */
	private static function clean( $widget, array $atts ) {
		$map   = self::attribute_map();
		$clean = array();
		foreach ( $map[ $widget ] as $name => $definition ) {
			$value          = array_key_exists( $name, $atts ) ? self::clean_value( $name, $definition['type'], $atts[ $name ] ) : null;
			$clean[ $name ] = null === $value ? $definition['default'] : $value;
		}
		return $clean;
	}

	/**
	 * One validated value.
	 *
	 * @param string $name The attribute.
	 * @param string $type `string`, `integer` or `boolean`.
	 * @param mixed  $raw  The value as written.
	 * @return string|int|bool|null The value, or null when it is empty or not valid (the default applies).
	 */
	private static function clean_value( $name, $type, $raw ) {
		if ( 'boolean' === $type ) {
			return self::read_bool( $raw );
		}
		if ( 'integer' === $type ) {
			return self::read_int( $name, $raw );
		}
		if ( is_int( $raw ) || is_float( $raw ) ) {
			$raw = (string) $raw;
		}
		if ( ! is_string( $raw ) ) {
			return null;
		}
		$raw = trim( $raw );
		if ( '' === $raw ) {
			return null;
		}

		switch ( $name ) {
			case 'lang':
				$raw = strtolower( $raw );
				return in_array( $raw, Settings::LANGUAGES, true ) ? $raw : null;
			case 'checkin':
			case 'checkout':
				return ( 1 === preg_match( self::DATE_PATTERN, $raw, $date ) && checkdate( (int) $date[2], (int) $date[3], (int) $date[1] ) ) ? $raw : null;
			case 'primary':
				return 1 === preg_match( self::COLOR_PATTERN, $raw ) ? $raw : null;
			case 'radius':
				if ( 1 !== preg_match( self::RADIUS_PATTERN, $raw, $radius ) ) {
					return null;
				}
				return (int) $radius[1] <= ( 'px' === $radius[2] ? 32 : 2 ) ? $raw : null;
			case 'font':
				$raw = strtolower( $raw );
				return in_array( $raw, self::FONTS, true ) ? $raw : null;
			case 'slug':
				return ( strlen( $raw ) <= Settings::MAX_SLUG_LENGTH && 1 === preg_match( Settings::SLUG_PATTERN, $raw ) ) ? $raw : null;
			case 'target':
				$target = self::sanitize_target( $raw );
				return '' === $target ? null : $target;
			case 'destinations':
				$wanted = self::read_bool( $raw );
				return null === $wanted ? null : ( $wanted ? 'yes' : 'no' );
			case 'label':
				$label = trim( mb_substr( sanitize_text_field( $raw ), 0, self::MAX_LABEL_LENGTH ) );
				return '' === $label ? null : $label;
			default:
				return null;
		}
	}

	/**
	 * A boolean attribute: `true`, `1`, `yes`, `on` and their opposites, in any case; anything else is not valid.
	 *
	 * @param mixed $raw The value as written.
	 * @return bool|null
	 */
	private static function read_bool( $raw ) {
		if ( is_bool( $raw ) ) {
			return $raw;
		}
		if ( is_int( $raw ) && ( 0 === $raw || 1 === $raw ) ) {
			return 1 === $raw;
		}
		if ( is_string( $raw ) ) {
			$value = strtolower( trim( $raw ) );
			if ( in_array( $value, array( 'true', '1', 'yes', 'on' ), true ) ) {
				return true;
			}
			if ( in_array( $value, array( 'false', '0', 'no', 'off' ), true ) ) {
				return false;
			}
		}
		return null;
	}

	/**
	 * A whole number attribute, inside the range of its attribute.
	 *
	 * @param string $name The attribute: `guests`, `min_height` or `max_guests`.
	 * @param mixed  $raw  The value as written.
	 * @return int|null
	 */
	private static function read_int( $name, $raw ) {
		if ( is_float( $raw ) && floor( $raw ) === $raw ) {
			$raw = (int) $raw;
		}
		if ( is_string( $raw ) ) {
			$raw = trim( $raw );
			if ( 1 !== preg_match( '/^[0-9]{1,5}$/D', $raw ) ) {
				return null;
			}
			$raw = (int) $raw;
		}
		if ( ! is_int( $raw ) ) {
			return null;
		}

		switch ( $name ) {
			case 'guests':
				return ( $raw >= 1 && $raw <= self::MAX_GUESTS ) ? $raw : null;
			case 'min_height':
				return ( $raw >= self::MIN_HEIGHT && $raw <= self::MAX_HEIGHT ) ? $raw : null;
			case 'max_guests':
				return ( $raw >= 1 && $raw <= self::MAX_SEARCH_GUESTS ) ? $raw : null;
			default:
				return null;
		}
	}

	/**
	 * The element of a widget: one `<div>` with the attributes the loader reads, in this order, only those that have a value.
	 *
	 * @param string $widget   The widget.
	 * @param array  $clean    The validated attributes.
	 * @param array  $settings The settings (the address is not empty).
	 * @return string
	 */
	private static function element( $widget, array $clean, array $settings ) {
		$attributes = array(
			'data-casazen-widget' => $widget,
			'data-casazen-base'   => $settings['address'],
		);
		if ( '' !== $settings['org_slug'] ) {
			$attributes['data-casazen-org'] = $settings['org_slug'];
		}
		$attributes['data-casazen-lang'] = Language::resolve( '' === $clean['lang'] ? null : $clean['lang'] );

		if ( 'property' === $widget ) {
			$attributes['data-casazen-property'] = $clean['slug'];
		}
		foreach ( array( 'checkin', 'checkout' ) as $name ) {
			if ( isset( $clean[ $name ] ) && '' !== $clean[ $name ] ) {
				$attributes[ 'data-casazen-' . $name ] = $clean[ $name ];
			}
		}
		if ( isset( $clean['guests'] ) ) {
			$attributes['data-casazen-guests'] = (string) $clean['guests'];
		}
		if ( 'search' === $widget ) {
			$attributes['data-casazen-target'] = '' !== $clean['target'] ? $clean['target'] : self::default_target();
		}
		if ( array_key_exists( 'datalayer', $clean ) ) {
			$attributes['data-casazen-datalayer'] = $clean['datalayer'] ? 'true' : 'false';
		}
		if ( array_key_exists( 'sync_url', $clean ) ) {
			$attributes['data-casazen-sync-url'] = $clean['sync_url'] ? 'true' : 'false';
		}
		if ( isset( $clean['min_height'] ) ) {
			$attributes['data-casazen-min-height'] = (string) $clean['min_height'];
		}
		if ( 'search' === $widget ) {
			if ( isset( $clean['max_guests'] ) ) {
				$attributes['data-casazen-max-guests'] = (string) $clean['max_guests'];
			}
			if ( 'yes' === $clean['destinations'] ) {
				$json = Destinations::to_json( Destinations::for_search() );
				if ( '' !== $json ) {
					$attributes['data-casazen-destinations'] = $json;
				}
			}
		}

		$theme = array();
		foreach ( array( 'primary', 'radius', 'font' ) as $name ) {
			if ( isset( $clean[ $name ] ) && '' !== $clean[ $name ] ) {
				$theme[ $name ] = $clean[ $name ];
			}
		}
		if ( array() !== $theme ) {
			$json = wp_json_encode( $theme );
			if ( is_string( $json ) ) {
				$attributes['data-casazen-theme'] = $json;
			}
		}

		$pairs = array();
		foreach ( $attributes as $name => $value ) {
			$pairs[] = $name . '="' . esc_attr( $value ) . '"';
		}

		$html = '<div class="casazen-widget casazen-widget--' . esc_attr( $widget ) . '" ' . implode( ' ', $pairs ) . '>'
			. self::fallback_link( $widget, $clean, $settings )
			. '</div>';
		return (string) preg_replace( '/[\r\n]+/', ' ', $html );
	}

	/**
	 * The address a search bar leads to when its author gave none: the page that has the role of the booking engine, else the
	 * home page of the site.
	 *
	 * @return string
	 */
	private static function default_target() {
		$target = self::sanitize_target( Pages::url_for_role( Pages::ROLE_BOOKING ) );
		return '' !== $target ? $target : home_url( '/' );
	}

	/**
	 * The link a browser without JavaScript shows in the place of the widget: the same page the loader links to when a frame does
	 * not come.
	 *
	 * @param string $widget   The widget.
	 * @param array  $clean    The validated attributes.
	 * @param array  $settings The settings.
	 * @return string
	 */
	private static function fallback_link( $widget, array $clean, array $settings ) {
		$home = '' !== $settings['org_slug'] ? '/book/' . $settings['org_slug'] : '';
		$page = '' !== $home ? $home : '/';
		if ( 'property' === $widget ) {
			$page = $home . '/property/' . $clean['slug'];
		} elseif ( 'guest-access' === $widget ) {
			$page = $home . '/my-bookings';
		}

		$authority = (string) preg_replace( '#^https?://#i', '', $settings['address'] );
		$text      = 'guest-access' === $widget
			/* translators: %s: the host name of the CasaZen address, for example prenota.example.com. */
			? esc_html__( 'Manage your booking on %s', 'casazen' )
			/* translators: %s: the host name of the CasaZen address, for example prenota.example.com. */
			: esc_html__( 'Book on %s', 'casazen' );

		return '<noscript><a href="' . esc_url( $settings['address'] . $page ) . '" rel="noopener">' . sprintf( $text, esc_html( $authority ) ) . '</a></noscript>';
	}

	/**
	 * The owner link: one paragraph with a link to the sign-in of the owner portal. It never is a frame.
	 *
	 * @param array $settings The settings (the address is not empty).
	 * @param array $atts     The attributes as written (only `label` is read).
	 * @return string
	 */
	private static function owner_login( array $settings, array $atts ) {
		$connection = Connection::current();
		if ( is_array( $connection ) && is_array( $connection['surfaces'] ) && false === $connection['surfaces']['ownerPortal'] ) {
			return self::hidden(
				'CasaZen: the owner portal is not enabled for this agency yet.',
				__( 'CasaZen: the owner portal is not enabled for this agency yet.', 'casazen' )
			);
		}

		$clean = self::clean( self::OWNER_LOGIN, $atts );
		$label = '' !== $clean['label'] ? $clean['label'] : __( 'Owner area', 'casazen' );

		return '<p class="casazen-owner-login"><a class="casazen-owner-login__link wp-element-button" href="'
			. esc_url( $settings['address'] . self::OWNER_LOGIN_PATH ) . '" rel="noopener">' . esc_html( $label ) . '</a></p>';
	}

	/**
	 * What replaces a widget that must not be shown: an HTML comment for everybody, and the notice for administrators.
	 *
	 * @param string $comment The text of the comment (English, no double hyphen).
	 * @param string $notice  The text of the notice (translated).
	 * @return string
	 */
	private static function hidden( $comment, $notice ) {
		return '<!-- ' . $comment . ' -->' . self::notice( $notice );
	}

	/**
	 * A visible dashed notice, only for users who can manage the options of the site.
	 *
	 * @param string $text The text.
	 * @return string The notice, or an empty string for everybody else.
	 */
	private static function notice( $text ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return '';
		}
		return '<div class="casazen-notice" style="border:1px dashed #8c8f94;padding:8px 12px;margin:8px 0;">' . esc_html( $text ) . '</div>';
	}
}
