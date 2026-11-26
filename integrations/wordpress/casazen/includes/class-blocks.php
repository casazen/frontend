<?php
/**
 * The five Gutenberg blocks of the plugin.
 *
 * @package Casazen
 */

namespace Casazen;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the blocks from the build of `blocks/src` (`blocks/build/<name>`). Every block is dynamic: the editor script only
 * draws a placeholder with the controls of the attributes, and Renderer::widget() prints the front end, exactly as the shortcode
 * of the same name does.
 */
class Blocks {

	/**
	 * The widgets that have a block. The block is `casazen/<widget>` and its folder is `blocks/build/<widget>`.
	 *
	 * @var string[]
	 */
	const WIDGETS = array( 'booking', 'property', 'search', 'guest-access', 'owner-login' );

	/**
	 * Registers the blocks on init.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'init', array( __CLASS__, 'register' ) );
	}

	/**
	 * Registers each block whose build exists. A block whose folder is missing (a checkout that was never built) is skipped
	 * without a word: the shortcodes still work.
	 *
	 * @return void
	 */
	public static function register() {
		foreach ( self::WIDGETS as $widget ) {
			$dir = CASAZEN_DIR . 'blocks/build/' . $widget;
			if ( ! is_readable( $dir . '/block.json' ) ) {
				continue;
			}

			$type = register_block_type(
				$dir,
				array( 'render_callback' => self::render_callback( $widget ) )
			);
			if ( $type instanceof \WP_Block_Type ) {
				foreach ( $type->editor_script_handles as $handle ) {
					wp_set_script_translations( $handle, 'casazen', CASAZEN_DIR . 'languages' );
				}
			}
		}
	}

	/**
	 * The function that prints a block on the front end: the renderer with the attributes of the block.
	 *
	 * @param string $widget One of WIDGETS.
	 * @return callable
	 */
	public static function render_callback( $widget ) {
		return static function ( $attributes = array() ) use ( $widget ) {
			return Renderer::widget( $widget, is_array( $attributes ) ? $attributes : array() );
		};
	}
}
