<?php
/**
 * The five shortcodes of the plugin.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the shortcodes. Each one hands its attributes to Renderer::widget() and returns what it gives back: no markup is
 * built here.
 */
class Shortcodes {

	/**
	 * The shortcode tags and the widget each one prints.
	 *
	 * @var string[]
	 */
	const TAGS = array(
		'casazen_booking'      => 'booking',
		'casazen_property'     => 'property',
		'casazen_search'       => 'search',
		'casazen_guest_access' => 'guest-access',
		'casazen_owner_login'  => 'owner-login',
	);

	/**
	 * Registers the shortcodes.
	 *
	 * @return void
	 */
	public static function init() {
		foreach ( array_keys( self::TAGS ) as $tag ) {
			add_shortcode( $tag, array( __CLASS__, 'render' ) );
		}
	}

	/**
	 * The callback of every shortcode.
	 *
	 * @param array|string $atts    The attributes (WordPress passes an empty string when there are none).
	 * @param string       $content The enclosed content (the shortcodes do not enclose anything).
	 * @param string       $tag     The tag that was used.
	 * @return string
	 */
	public static function render( $atts = array(), $content = '', $tag = '' ) {
		unset( $content );
		if ( ! is_string( $tag ) || ! isset( self::TAGS[ $tag ] ) ) {
			return '';
		}
		return Renderer::widget( self::TAGS[ $tag ], is_array( $atts ) ? $atts : array() );
	}
}
